import { crc32, inflateSync } from 'node:zlib';
import { corrupted } from '../media-format.error';
import { MAX_DECODED_IMAGE_BYTES, MAX_IMAGE_DIMENSION } from '../media-formats';

const SIGNATURE_LENGTH = 8;
const CHUNK_OVERHEAD = 12; // length + type + CRC
const KNOWN_CRITICAL_CHUNKS = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND']);

/** Số kênh và bit depth hợp lệ theo color type (PNG spec §11.2.2). */
const COLOR_TYPES: Record<number, { channels: number; bitDepths: number[] }> = {
  0: { channels: 1, bitDepths: [1, 2, 4, 8, 16] },
  2: { channels: 3, bitDepths: [8, 16] },
  3: { channels: 1, bitDepths: [1, 2, 4, 8] },
  4: { channels: 2, bitDepths: [8, 16] },
  6: { channels: 4, bitDepths: [8, 16] },
};

/** Các lượt Adam7: [xStart, yStart, xStep, yStep]. */
const ADAM7_PASSES: Array<[number, number, number, number]> = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
];

interface PngHeader {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  interlace: number;
}

function parseHeader(data: Buffer): PngHeader {
  if (data.length !== 13) throw corrupted('Chunk IHDR của PNG phải dài 13 byte');
  const header: PngHeader = {
    width: data.readUInt32BE(0),
    height: data.readUInt32BE(4),
    bitDepth: data[8],
    colorType: data[9],
    interlace: data[12],
  };
  if (header.width === 0 || header.height === 0) {
    throw corrupted('Kích thước ảnh PNG phải lớn hơn 0');
  }
  if (header.width > MAX_IMAGE_DIMENSION || header.height > MAX_IMAGE_DIMENSION) {
    throw corrupted(`Ảnh PNG vượt quá ${MAX_IMAGE_DIMENSION}×${MAX_IMAGE_DIMENSION} pixel`);
  }
  const colorType = COLOR_TYPES[header.colorType];
  if (!colorType || !colorType.bitDepths.includes(header.bitDepth)) {
    throw corrupted('Tổ hợp color type / bit depth của PNG không hợp lệ');
  }
  if (data[10] !== 0 || data[11] !== 0) {
    throw corrupted('Phương thức nén/lọc của PNG không hợp lệ');
  }
  if (header.interlace > 1) throw corrupted('Kiểu interlace của PNG không hợp lệ');
  return header;
}

/** Danh sách [số dòng, byte mỗi dòng (gồm byte filter)] của từng lượt quét. */
function scanlineLayout(header: PngHeader): Array<[number, number]> {
  const bitsPerPixel = COLOR_TYPES[header.colorType].channels * header.bitDepth;
  const passes = header.interlace === 1 ? ADAM7_PASSES : [[0, 0, 1, 1] as [number, number, number, number]];
  const layout: Array<[number, number]> = [];
  for (const [xStart, yStart, xStep, yStep] of passes) {
    const passWidth = Math.ceil((header.width - xStart) / xStep);
    const passHeight = Math.ceil((header.height - yStart) / yStep);
    if (passWidth <= 0 || passHeight <= 0) continue;
    layout.push([passHeight, 1 + Math.ceil((passWidth * bitsPerPixel) / 8)]);
  }
  return layout;
}

/** Giải nén IDAT và đối chiếu kích thước + byte filter của từng dòng với IHDR. */
function verifyPixelData(header: PngHeader, compressed: Buffer): void {
  const layout = scanlineLayout(header);
  const expectedBytes = layout.reduce((sum, [rows, rowBytes]) => sum + rows * rowBytes, 0);
  if (expectedBytes > MAX_DECODED_IMAGE_BYTES) {
    throw corrupted('Dữ liệu điểm ảnh PNG sau giải nén quá lớn');
  }

  let pixels: Buffer;
  try {
    pixels = inflateSync(compressed, { maxOutputLength: expectedBytes + 1 });
  } catch {
    throw corrupted('Dữ liệu ảnh PNG không giải nén được');
  }
  if (pixels.length !== expectedBytes) {
    throw corrupted('Dung lượng dữ liệu điểm ảnh PNG không khớp kích thước khai báo');
  }

  let offset = 0;
  for (const [rows, rowBytes] of layout) {
    for (let row = 0; row < rows; row++) {
      if (pixels[offset] > 4) throw corrupted('Kiểu filter dòng quét PNG không hợp lệ');
      offset += rowBytes;
    }
  }
}

/**
 * Kiểm tra cấu trúc PNG: chuỗi chunk, CRC, IHDR, PLTE, IDAT, IEND và giải nén dữ liệu
 * điểm ảnh để chắc chắn ảnh decode được.
 */
export function validatePng(buffer: Buffer): void {
  let offset = SIGNATURE_LENGTH;
  let header: PngHeader | null = null;
  let hasPalette = false;
  let hasEnd = false;
  const idatParts: Buffer[] = [];

  while (offset < buffer.length && !hasEnd) {
    if (offset + CHUNK_OVERHEAD > buffer.length) throw corrupted('File PNG bị cắt cụt');
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    const dataEnd = offset + 8 + length;
    if (!/^[A-Za-z]{4}$/.test(type)) throw corrupted('Tên chunk PNG không hợp lệ');
    if (length > 0x7fffffff || dataEnd + 4 > buffer.length) throw corrupted('File PNG bị cắt cụt');
    if (crc32(buffer.subarray(offset + 4, dataEnd)) !== buffer.readUInt32BE(dataEnd)) {
      throw corrupted(`CRC của chunk ${type} trong PNG không khớp`);
    }
    if (!header && type !== 'IHDR') throw corrupted('Chunk đầu tiên của PNG phải là IHDR');

    const data = buffer.subarray(offset + 8, dataEnd);
    switch (type) {
      case 'IHDR':
        if (header) throw corrupted('PNG có nhiều chunk IHDR');
        header = parseHeader(data);
        break;
      case 'PLTE':
        if (data.length === 0 || data.length % 3 !== 0 || data.length > 768) {
          throw corrupted('Bảng màu PLTE của PNG không hợp lệ');
        }
        hasPalette = true;
        break;
      case 'IDAT':
        idatParts.push(data);
        break;
      case 'IEND':
        hasEnd = true;
        break;
      default:
        // Chunk bắt buộc (chữ cái đầu viết hoa) không xác định → decoder phải từ chối.
        if (type[0] === type[0].toUpperCase() && !KNOWN_CRITICAL_CHUNKS.has(type)) {
          throw corrupted(`PNG chứa chunk bắt buộc không xác định: ${type}`);
        }
    }
    offset = dataEnd + 4;
  }

  if (!header) throw corrupted('PNG thiếu chunk IHDR');
  if (!hasEnd) throw corrupted('PNG thiếu chunk IEND (file bị cắt cụt)');
  if (idatParts.length === 0) throw corrupted('PNG không chứa dữ liệu ảnh (IDAT)');
  if (header.colorType === 3 && !hasPalette) throw corrupted('PNG dạng palette thiếu chunk PLTE');
  verifyPixelData(header, Buffer.concat(idatParts));
}
