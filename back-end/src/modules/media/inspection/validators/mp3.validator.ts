import { corrupted } from '../media-format.error';
import { isMp3FrameSync } from '../media-signature';

/** Số khung liên tiếp tối thiểu để coi luồng là MP3 decode được. */
const MIN_CONSECUTIVE_FRAMES = 3;
/** Byte 0x00 đệm tối đa giữa thẻ ID3 và khung đầu tiên. */
const MAX_LEADING_PADDING = 64 * 1024;
const ID3V1_TAG_LENGTH = 128;

/** Bitrate (kbps) Layer III theo chỉ số; 0 = free format, 15 = không hợp lệ. */
const BITRATES_MPEG1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const BITRATES_MPEG2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
/** Tần số lấy mẫu theo bit version: 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5. */
const SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  0: [11025, 12000, 8000],
};

interface FrameHeader {
  version: number;
  sampleRate: number;
  length: number;
}

/** Đọc header khung MPEG Layer III tại `offset`; `null` nếu không hợp lệ. */
export function readMp3FrameHeader(buffer: Buffer, offset: number): FrameHeader | null {
  if (offset + 4 > buffer.length || !isMp3FrameSync(buffer, offset)) return null;
  const version = (buffer[offset + 1] >> 3) & 0x03;
  if (version === 1) return null; // reserved
  const bitrateIndex = buffer[offset + 2] >> 4;
  const sampleRateIndex = (buffer[offset + 2] >> 2) & 0x03;
  if (bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) return null;

  const isMpeg1 = version === 3;
  const bitrate = (isMpeg1 ? BITRATES_MPEG1 : BITRATES_MPEG2)[bitrateIndex] * 1000;
  const sampleRate = SAMPLE_RATES[version][sampleRateIndex];
  const padding = (buffer[offset + 2] >> 1) & 0x01;
  const length = Math.floor(((isMpeg1 ? 144 : 72) * bitrate) / sampleRate) + padding;
  return { version, sampleRate, length };
}

/** Bỏ qua thẻ ID3v2 ở đầu file; trả về vị trí sau thẻ. */
function skipId3v2(buffer: Buffer): number {
  if (buffer.toString('latin1', 0, 3) !== 'ID3') return 0;
  if (buffer.length < 10) throw corrupted('Thẻ ID3 của MP3 bị cắt cụt');
  const major = buffer[3];
  if (major < 2 || major > 4 || buffer[4] === 0xff) throw corrupted('Header thẻ ID3 của MP3 không hợp lệ');
  let size = 0;
  for (let index = 6; index < 10; index++) {
    if (buffer[index] & 0x80) throw corrupted('Kích thước thẻ ID3 của MP3 không hợp lệ');
    size = (size << 7) | buffer[index];
  }
  const hasFooter = (buffer[5] & 0x10) !== 0;
  return 10 + size + (hasFooter ? 10 : 0);
}

function isOnlyId3v1Tag(buffer: Buffer, offset: number): boolean {
  const remaining = buffer.length - offset;
  return (
    remaining === 0 ||
    (remaining === ID3V1_TAG_LENGTH && buffer.toString('latin1', offset, offset + 3) === 'TAG')
  );
}

/**
 * Kiểm tra luồng MP3: bỏ qua ID3v2, sau đó phải có chuỗi khung Layer III liên tiếp với
 * header hợp lệ và cùng version/sample rate (hoặc file ngắn kết thúc gọn sau các khung).
 */
export function validateMp3(buffer: Buffer): void {
  let offset = skipId3v2(buffer);
  if (offset >= buffer.length) throw corrupted('File MP3 chỉ có thẻ ID3, không có dữ liệu âm thanh');

  const paddingLimit = Math.min(buffer.length, offset + MAX_LEADING_PADDING);
  while (offset < paddingLimit && buffer[offset] === 0x00) offset++;

  let frames = 0;
  let first: FrameHeader | null = null;
  while (frames < MIN_CONSECUTIVE_FRAMES) {
    const header = readMp3FrameHeader(buffer, offset);
    if (!header || offset + header.length > buffer.length) break;
    if (first && (header.version !== first.version || header.sampleRate !== first.sampleRate)) break;
    first ??= header;
    frames++;
    offset += header.length;
  }

  const isShortCompleteStream = frames > 0 && isOnlyId3v1Tag(buffer, offset);
  if (frames < MIN_CONSECUTIVE_FRAMES && !isShortCompleteStream) {
    throw corrupted('Không tìm thấy chuỗi khung âm thanh MP3 hợp lệ');
  }
}
