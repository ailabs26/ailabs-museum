import { MediaFormat } from './media-formats';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const MARKUP_PATTERN = /<\s*(svg|script|html|body|iframe|\?php|\?xml|!doctype)/i;
const MARKUP_SCAN_BYTES = 1024;

function startsWithAscii(buffer: Buffer, text: string, offset = 0): boolean {
  if (buffer.length < offset + text.length) return false;
  return buffer.toString('latin1', offset, offset + text.length) === text;
}

function stripUtf8Bom(buffer: Buffer): Buffer {
  return buffer.subarray(0, 3).equals(UTF8_BOM) ? buffer.subarray(3) : buffer;
}

/** Header khung MPEG Audio Layer III: 11 bit sync + layer = 01. */
export function isMp3FrameSync(buffer: Buffer, offset: number): boolean {
  if (buffer.length < offset + 2) return false;
  const second = buffer[offset + 1];
  return buffer[offset] === 0xff && (second & 0xe0) === 0xe0 && ((second >> 1) & 0x03) === 0x01;
}

function isWebVtt(buffer: Buffer): boolean {
  const body = stripUtf8Bom(buffer);
  if (!startsWithAscii(body, 'WEBVTT')) return false;
  // Sau "WEBVTT" chỉ được là hết file, khoảng trắng hoặc xuống dòng (WebVTT spec).
  if (body.length === 6) return true;
  return [0x20, 0x09, 0x0a, 0x0d].includes(body[6]);
}

/**
 * Xác định định dạng THỰC TẾ của file từ magic bytes (NFR-19). Không dùng Content-Type
 * hay phần mở rộng do client gửi. Trả `null` nếu không thuộc danh sách cho phép.
 */
export function detectMediaFormat(buffer: Buffer): MediaFormat | null {
  if (buffer.length >= PNG_SIGNATURE.length && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return MediaFormat.PNG;
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return MediaFormat.JPEG;
  }
  if (startsWithAscii(buffer, 'glTF')) {
    return MediaFormat.GLB;
  }
  if (startsWithAscii(buffer, 'RIFF') && startsWithAscii(buffer, 'WEBP', 8)) {
    return MediaFormat.WEBP;
  }
  if (isWebVtt(buffer)) {
    return MediaFormat.VTT;
  }
  if (startsWithAscii(buffer, 'ID3') || isMp3FrameSync(buffer, 0)) {
    return MediaFormat.MP3;
  }
  return null;
}

/**
 * Nhận diện nội dung dạng markup/script (SVG, HTML, XML, PHP) để báo lỗi rõ ràng.
 * Chỉ dùng cho file đã KHÔNG khớp định dạng nào — SVG luôn bị từ chối.
 */
export function looksLikeMarkup(buffer: Buffer): boolean {
  const head = stripUtf8Bom(buffer.subarray(0, MARKUP_SCAN_BYTES)).toString('latin1');
  return head.trimStart().startsWith('<') || MARKUP_PATTERN.test(head);
}
