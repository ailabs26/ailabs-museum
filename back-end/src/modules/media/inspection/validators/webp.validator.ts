import { corrupted } from '../media-format.error';
import { MAX_IMAGE_DIMENSION } from '../media-formats';

const RIFF_HEADER = 12; // "RIFF" + size + "WEBP"
const IMAGE_CHUNKS = new Set(['VP8 ', 'VP8L', 'VP8X']);

function assertDimensions(width: number, height: number): void {
  if (width === 0 || height === 0) throw corrupted('Kích thước ảnh WebP phải lớn hơn 0');
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    throw corrupted(`Ảnh WebP vượt quá ${MAX_IMAGE_DIMENSION}×${MAX_IMAGE_DIMENSION} pixel`);
  }
}

/** Bitstream lossy (VP8): key frame, start code 9D 01 2A, kích thước và partition hợp lệ. */
function validateLossy(data: Buffer): void {
  if (data.length < 10) throw corrupted('Dữ liệu VP8 của WebP quá ngắn');
  const frameTag = data[0] | (data[1] << 8) | (data[2] << 16);
  if ((frameTag & 0x01) !== 0) throw corrupted('Ảnh WebP lossy phải bắt đầu bằng key frame');
  if (((frameTag >> 1) & 0x07) > 3) throw corrupted('Phiên bản VP8 của WebP không hợp lệ');
  if (10 + (frameTag >>> 5) > data.length) throw corrupted('Partition VP8 vượt quá dữ liệu WebP');
  if (data[3] !== 0x9d || data[4] !== 0x01 || data[5] !== 0x2a) {
    throw corrupted('Start code VP8 của WebP không hợp lệ');
  }
  assertDimensions(data.readUInt16LE(6) & 0x3fff, data.readUInt16LE(8) & 0x3fff);
}

/** Bitstream lossless (VP8L): chữ ký 0x2F, version 0, kích thước 14 bit. */
function validateLossless(data: Buffer): void {
  if (data.length < 5) throw corrupted('Dữ liệu VP8L của WebP quá ngắn');
  if (data[0] !== 0x2f) throw corrupted('Chữ ký VP8L của WebP không hợp lệ');
  const bits = data.readUInt32LE(1);
  if (bits >>> 29 !== 0) throw corrupted('Phiên bản VP8L của WebP không hợp lệ');
  assertDimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
}

/** Header mở rộng (VP8X): kích thước canvas 24 bit. */
function validateExtendedHeader(data: Buffer): void {
  if (data.length < 10) throw corrupted('Header VP8X của WebP không hợp lệ');
  assertDimensions(data.readUIntLE(4, 3) + 1, data.readUIntLE(7, 3) + 1);
}

/**
 * Kiểm tra cấu trúc WebP: kích thước RIFF, chuỗi chunk trong giới hạn file, chunk đầu
 * là VP8/VP8L/VP8X và có dữ liệu ảnh với header bitstream hợp lệ.
 */
export function validateWebp(buffer: Buffer): void {
  if (buffer.length < RIFF_HEADER + 8) throw corrupted('File WebP quá ngắn');
  const riffEnd = 8 + buffer.readUInt32LE(4);
  if (riffEnd > buffer.length) throw corrupted('File WebP bị cắt cụt (kích thước RIFF lớn hơn file)');
  if (riffEnd < RIFF_HEADER + 8) throw corrupted('Kích thước RIFF của WebP không hợp lệ');

  let offset = RIFF_HEADER;
  let isFirstChunk = true;
  let hasImage = false;

  while (offset + 8 <= riffEnd) {
    const fourCc = buffer.toString('latin1', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const dataEnd = offset + 8 + size;
    if (dataEnd > riffEnd) throw corrupted(`Chunk ${fourCc.trim()} vượt quá kích thước file WebP`);
    const data = buffer.subarray(offset + 8, dataEnd);

    if (isFirstChunk && !IMAGE_CHUNKS.has(fourCc)) {
      throw corrupted('Chunk đầu tiên của WebP phải là VP8, VP8L hoặc VP8X');
    }
    switch (fourCc) {
      case 'VP8 ':
        validateLossy(data);
        hasImage = true;
        break;
      case 'VP8L':
        validateLossless(data);
        hasImage = true;
        break;
      case 'VP8X':
        if (!isFirstChunk) throw corrupted('Chunk VP8X của WebP phải đứng đầu');
        validateExtendedHeader(data);
        break;
      case 'ANMF':
        // Khung ảnh động: header 16 byte + ít nhất một chunk con.
        if (size < 24) throw corrupted('Khung ảnh động (ANMF) của WebP không hợp lệ');
        hasImage = true;
        break;
      default:
      // ICCP, EXIF, XMP, ALPH, ANIM...: metadata hợp lệ, bỏ qua.
    }
    isFirstChunk = false;
    offset = dataEnd + (size % 2); // chunk RIFF được đệm tới số byte chẵn
  }

  if (!hasImage) throw corrupted('WebP không chứa dữ liệu ảnh');
}
