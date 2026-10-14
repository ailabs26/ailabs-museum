import { corrupted } from '../media-format.error';

const HEADER_LINE = /^WEBVTT(?:[ \t].*)?$/;
const TIMING_LINE = /^(\S+)[ \t]+-->[ \t]+(\S+)(?:[ \t].*)?$/;
/** [hh:]mm:ss.ttt — giờ (nếu có) tối thiểu 2 chữ số, phút/giây 00–59. */
const TIMESTAMP = /^(?:(\d{2,}):)?([0-5]\d):([0-5]\d)\.(\d{3})$/;
const MAX_QUOTED_LENGTH = 60;

function quote(line: string): string {
  return line.length > MAX_QUOTED_LENGTH ? `${line.slice(0, MAX_QUOTED_LENGTH)}…` : line;
}

function parseTimestamp(value: string): number | null {
  const match = TIMESTAMP.exec(value);
  if (!match) return null;
  const [, hours = '0', minutes, seconds, millis] = match;
  return ((Number(hours) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000 + Number(millis);
}

function decodeUtf8(buffer: Buffer): string {
  try {
    // TextDecoder mặc định bỏ BOM UTF-8 ở đầu.
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw corrupted('Phụ đề phải được mã hóa UTF-8 hợp lệ');
  }
}

/** Tách nội dung thành các khối, phân cách bởi một hoặc nhiều dòng trống. */
function splitBlocks(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.trim() === '') {
      if (current.length) blocks.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);
  return blocks;
}

/**
 * Kiểm tra phụ đề WebVTT: UTF-8 hợp lệ, dòng đầu "WEBVTT", mỗi cue có dòng thời gian
 * hợp lệ (kết thúc sau bắt đầu) và các cue theo thứ tự thời gian bắt đầu tăng dần.
 */
export function validateVtt(buffer: Buffer): void {
  const text = decodeUtf8(buffer);
  if (text.includes('\u0000')) throw corrupted('Phụ đề chứa ký tự NUL');

  const [headerBlock, ...blocks] = splitBlocks(text.replace(/\r\n?/g, '\n').split('\n'));
  if (!headerBlock || !HEADER_LINE.test(headerBlock[0])) {
    throw corrupted('Dòng đầu tiên của phụ đề phải là "WEBVTT"');
  }
  if (headerBlock.slice(1).some((line) => line.includes('-->'))) {
    throw corrupted('Cần một dòng trống giữa header "WEBVTT" và cue đầu tiên');
  }

  let cueCount = 0;
  let previousStart = -1;
  for (const block of blocks) {
    const first = block[0];
    if (/^NOTE(?:$|[ \t])/.test(first)) {
      if (block.some((line) => line.includes('-->'))) throw corrupted('Khối NOTE không được chứa "-->"');
      continue;
    }
    if (/^(?:STYLE|REGION)(?:$|[ \t])/.test(first)) {
      if (cueCount > 0) throw corrupted('Khối STYLE/REGION phải đặt trước cue đầu tiên');
      continue;
    }

    const cueNumber = cueCount + 1;
    const timingIndex = first.includes('-->') ? 0 : 1;
    const timing = block[timingIndex];
    if (timing === undefined || !timing.includes('-->')) {
      throw corrupted(`Cue thứ ${cueNumber} thiếu dòng thời gian "bắt đầu --> kết thúc"`);
    }
    const match = TIMING_LINE.exec(timing);
    const start = match ? parseTimestamp(match[1]) : null;
    const end = match ? parseTimestamp(match[2]) : null;
    if (start === null || end === null) {
      throw corrupted(`Cue thứ ${cueNumber} có timestamp không hợp lệ: "${quote(timing)}"`);
    }
    if (end <= start) throw corrupted(`Cue thứ ${cueNumber}: thời điểm kết thúc phải sau thời điểm bắt đầu`);
    if (start < previousStart) throw corrupted(`Cue thứ ${cueNumber} không theo thứ tự thời gian tăng dần`);
    if (block.slice(timingIndex + 1).some((line) => line.includes('-->'))) {
      throw corrupted(`Nội dung cue thứ ${cueNumber} không được chứa "-->"`);
    }
    previousStart = start;
    cueCount++;
  }

  if (cueCount === 0) throw corrupted('Phụ đề không có cue nào');
}
