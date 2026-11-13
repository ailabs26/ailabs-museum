import { corrupted } from '../media-format.error';
import { MAX_IMAGE_DIMENSION } from '../media-formats';

const MARKER_EOI = 0xd9;
const MARKER_SOS = 0xda;
/** Start-of-frame: baseline, extended, progressive, lossless (trừ DHT 0xc4, JPG 0xc8, DAC 0xcc). */
const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function isRestartMarker(marker: number): boolean {
  return marker >= 0xd0 && marker <= 0xd7;
}

function parseFrameHeader(segment: Buffer): void {
  if (segment.length < 6) throw corrupted('Header khung ảnh JPEG (SOF) không hợp lệ');
  const precision = segment[0];
  const height = segment.readUInt16BE(1);
  const width = segment.readUInt16BE(3);
  const components = segment[5];
  if (![8, 12, 16].includes(precision)) throw corrupted('Độ chính xác mẫu JPEG không hợp lệ');
  if (width === 0 || height === 0) throw corrupted('Kích thước ảnh JPEG phải lớn hơn 0');
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    throw corrupted(`Ảnh JPEG vượt quá ${MAX_IMAGE_DIMENSION}×${MAX_IMAGE_DIMENSION} pixel`);
  }
  if (components < 1 || components > 4 || segment.length !== 6 + components * 3) {
    throw corrupted('Số thành phần màu của JPEG không hợp lệ');
  }
}

/** Bỏ qua dữ liệu entropy sau SOS; trả về vị trí byte 0xFF của marker kế tiếp. */
function skipEntropyData(buffer: Buffer, start: number): number {
  let offset = start;
  for (;;) {
    offset = buffer.indexOf(0xff, offset);
    if (offset === -1 || offset + 1 >= buffer.length) {
      throw corrupted('JPEG kết thúc đột ngột (thiếu marker EOI)');
    }
    const next = buffer[offset + 1];
    // 0xFF00 là byte được "stuff", 0xFFD0..D7 là restart marker, 0xFFFF là byte đệm.
    if (next === 0x00 || isRestartMarker(next)) {
      offset += 2;
    } else if (next === 0xff) {
      offset += 1;
    } else {
      return offset;
    }
  }
}

/**
 * Kiểm tra cấu trúc JPEG: chuỗi segment hợp lệ, có SOF (kích thước hợp lệ) trước SOS,
 * có dữ liệu quét và kết thúc bằng EOI. Dữ liệu sau EOI bị bỏ qua.
 */
export function validateJpeg(buffer: Buffer): void {
  let offset = 2; // sau SOI (FF D8)
  let hasFrame = false;
  let scans = 0;

  for (;;) {
    if (offset >= buffer.length) throw corrupted('JPEG kết thúc đột ngột (thiếu marker EOI)');
    if (buffer[offset] !== 0xff) throw corrupted('Cấu trúc marker JPEG không hợp lệ');
    while (offset < buffer.length && buffer[offset] === 0xff) offset++;
    if (offset >= buffer.length) throw corrupted('JPEG kết thúc đột ngột (thiếu marker EOI)');

    const marker = buffer[offset++];
    if (marker === MARKER_EOI) {
      if (!hasFrame || scans === 0) throw corrupted('JPEG không chứa dữ liệu ảnh');
      return;
    }
    if (marker === 0x00 || marker === 0xd8) throw corrupted('Marker JPEG không hợp lệ');
    if (isRestartMarker(marker) || marker === 0x01) continue; // marker không có độ dài

    if (offset + 2 > buffer.length) throw corrupted('JPEG bị cắt cụt');
    const segmentLength = buffer.readUInt16BE(offset);
    const segmentEnd = offset + segmentLength;
    if (segmentLength < 2 || segmentEnd > buffer.length) throw corrupted('JPEG bị cắt cụt');
    const segment = buffer.subarray(offset + 2, segmentEnd);

    if (SOF_MARKERS.has(marker)) {
      if (hasFrame) throw corrupted('JPEG có nhiều header khung ảnh (SOF)');
      parseFrameHeader(segment);
      hasFrame = true;
      offset = segmentEnd;
    } else if (marker === MARKER_SOS) {
      if (!hasFrame) throw corrupted('JPEG có dữ liệu quét (SOS) trước header khung ảnh (SOF)');
      const components = segment[0];
      if (components < 1 || components > 4 || segment.length !== 4 + components * 2) {
        throw corrupted('Header quét (SOS) của JPEG không hợp lệ');
      }
      scans++;
      offset = skipEntropyData(buffer, segmentEnd);
    } else {
      offset = segmentEnd;
    }
  }
}
