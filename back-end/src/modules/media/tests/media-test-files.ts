import { deflateSync } from 'node:zlib';
import { crc32 } from '../inspection/crc32';

/**
 * Dựng file mẫu hợp lệ (và biến thể hỏng) bằng code cho test media — không commit file nhị phân.
 * Không phải file *.spec.ts nên node --test không chạy trực tiếp.
 */

// ---------------------------------------------------------------- PNG

export function pngChunk(type: string, data: Buffer, options: { badCrc?: boolean } = {}): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBytes = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4);
  const value = crc32(Buffer.concat([typeBytes, data]));
  crc.writeUInt32BE(options.badCrc ? (value ^ 0xffffffff) >>> 0 : value);
  return Buffer.concat([length, typeBytes, data, crc]);
}

export interface PngOptions {
  width?: number;
  height?: number;
  bitDepth?: number;
  colorType?: number;
  interlace?: number;
  /** Ghi đè dữ liệu IDAT (mặc định: pixel hợp lệ đã nén zlib). */
  idat?: Buffer;
  extraChunks?: Buffer[];
  omitIend?: boolean;
}

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Dữ liệu điểm ảnh thô (không interlace), mỗi dòng có byte filter = 0. */
function rawPixels(width: number, height: number, colorType: number, bitDepth: number): Buffer {
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType] ?? 4;
  const rowBytes = 1 + Math.ceil((width * channels * bitDepth) / 8);
  const raw = Buffer.alloc(rowBytes * height, 0x7f);
  for (let row = 0; row < height; row++) raw[row * rowBytes] = 0;
  return raw;
}

export function buildPng(options: PngOptions = {}): Buffer {
  const width = options.width ?? 4;
  const height = options.height ?? 3;
  const bitDepth = options.bitDepth ?? 8;
  const colorType = options.colorType ?? 6;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = bitDepth;
  ihdr[9] = colorType;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = options.interlace ?? 0;

  const idat = options.idat ?? deflateSync(rawPixels(width, height, colorType, bitDepth));

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    ...(options.extraChunks ?? []),
    pngChunk('IDAT', idat),
    ...(options.omitIend ? [] : [pngChunk('IEND', Buffer.alloc(0))]),
  ]);
}

/** PNG hợp lệ có tổng dung lượng đúng `totalBytes` (đệm bằng chunk phụ tEXt). */
export function buildPngOfSize(totalBytes: number): Buffer {
  const fillerLength = totalBytes - buildPng().length - 12;
  if (fillerLength < 2) throw new Error('totalBytes quá nhỏ');
  const text = Buffer.alloc(fillerLength, 0x61);
  text.write('k\0', 0, 'latin1');
  return buildPng({ extraChunks: [pngChunk('tEXt', text)] });
}

// ---------------------------------------------------------------- JPEG

function jpegSegment(marker: number, payload: Buffer): Buffer {
  const header = Buffer.alloc(4);
  header[0] = 0xff;
  header[1] = marker;
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([header, payload]);
}

export interface JpegOptions {
  width?: number;
  height?: number;
  /** Marker SOF (0xc0 baseline, 0xc2 progressive). */
  sofMarker?: number;
  omitSof?: boolean;
  omitEoi?: boolean;
  trailing?: Buffer;
}

export function buildJpeg(options: JpegOptions = {}): Buffer {
  const width = options.width ?? 16;
  const height = options.height ?? 8;
  const app0 = Buffer.from([0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const dqt = Buffer.concat([Buffer.from([0x00]), Buffer.alloc(64, 0x01)]);
  const sof = Buffer.alloc(9);
  sof[0] = 8; // precision
  sof.writeUInt16BE(height, 1);
  sof.writeUInt16BE(width, 3);
  sof[5] = 1; // 1 component
  sof[6] = 1; // component id
  sof[7] = 0x11; // sampling
  sof[8] = 0; // quant table
  const dht = Buffer.concat([Buffer.from([0x00]), Buffer.from([0, 1, ...Array(14).fill(0)]), Buffer.from([0x00])]);
  const sos = Buffer.from([0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]);
  // Dữ liệu entropy có byte 0xFF được "stuff" bằng 0x00 và một marker RST0.
  const scan = Buffer.from([0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd0, 0x78, 0x9a]);

  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    jpegSegment(0xe0, app0),
    jpegSegment(0xdb, dqt),
    ...(options.omitSof ? [] : [jpegSegment(options.sofMarker ?? 0xc0, sof)]),
    jpegSegment(0xc4, dht),
    jpegSegment(0xda, sos),
    scan,
    ...(options.omitEoi ? [] : [Buffer.from([0xff, 0xd9])]),
    options.trailing ?? Buffer.alloc(0),
  ]);
}

// ---------------------------------------------------------------- WebP

function riffChunk(fourCc: string, data: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.write(fourCc, 0, 'latin1');
  header.writeUInt32LE(data.length, 4);
  const padding = data.length % 2 === 1 ? Buffer.from([0]) : Buffer.alloc(0);
  return Buffer.concat([header, data, padding]);
}

export function wrapRiffWebp(chunks: Buffer[], options: { riffSizeDelta?: number } = {}): Buffer {
  const body = Buffer.concat([Buffer.from('WEBP', 'latin1'), ...chunks]);
  const header = Buffer.alloc(8);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(body.length + (options.riffSizeDelta ?? 0), 4);
  return Buffer.concat([header, body]);
}

export function vp8lChunk(width = 4, height = 3, options: { badSignature?: boolean; version?: number } = {}): Buffer {
  const data = Buffer.alloc(10, 0);
  data[0] = options.badSignature ? 0x2e : 0x2f;
  const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14) | ((options.version ?? 0) << 29);
  data.writeUInt32LE(bits >>> 0, 1);
  return riffChunk('VP8L', data);
}

export function vp8Chunk(width = 4, height = 3, options: { badStartCode?: boolean; interFrame?: boolean } = {}): Buffer {
  const data = Buffer.alloc(16, 0);
  // Frame tag: bit0 = 0 (key frame), bit4 = show_frame.
  data[0] = options.interFrame ? 0x11 : 0x10;
  data[1] = 0x00;
  data[2] = 0x00;
  data[3] = 0x9d;
  data[4] = 0x01;
  data[5] = options.badStartCode ? 0x2b : 0x2a;
  data.writeUInt16LE(width & 0x3fff, 6);
  data.writeUInt16LE(height & 0x3fff, 8);
  return riffChunk('VP8 ', data);
}

export function vp8xChunk(width = 4, height = 3): Buffer {
  const data = Buffer.alloc(10, 0);
  data.writeUIntLE(width - 1, 4, 3);
  data.writeUIntLE(height - 1, 7, 3);
  return riffChunk('VP8X', data);
}

export function buildWebp(kind: 'lossless' | 'lossy' | 'extended' = 'lossless'): Buffer {
  if (kind === 'lossy') return wrapRiffWebp([vp8Chunk()]);
  if (kind === 'extended') return wrapRiffWebp([vp8xChunk(), vp8lChunk()]);
  return wrapRiffWebp([vp8lChunk()]);
}

// ---------------------------------------------------------------- MP3

/** Khung MPEG-1 Layer III, 128 kbps, 44.1 kHz, không padding → 417 byte. */
export const MP3_FRAME_HEADER = Buffer.from([0xff, 0xfb, 0x90, 0x00]);
export const MP3_FRAME_LENGTH = 417;

export function mp3Frame(header: Buffer = MP3_FRAME_HEADER, length = MP3_FRAME_LENGTH): Buffer {
  const frame = Buffer.alloc(length, 0);
  header.copy(frame, 0);
  return frame;
}

export function id3Tag(bodyLength = 20): Buffer {
  const header = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0, 0, 0, 0]);
  // Kích thước dạng syncsafe (7 bit mỗi byte).
  header[6] = (bodyLength >> 21) & 0x7f;
  header[7] = (bodyLength >> 14) & 0x7f;
  header[8] = (bodyLength >> 7) & 0x7f;
  header[9] = bodyLength & 0x7f;
  return Buffer.concat([header, Buffer.alloc(bodyLength, 0)]);
}

export function buildMp3(options: { frames?: number; withId3?: boolean } = {}): Buffer {
  const frames = Array.from({ length: options.frames ?? 6 }, () => mp3Frame());
  return Buffer.concat([...(options.withId3 ? [id3Tag()] : []), ...frames]);
}

// ---------------------------------------------------------------- GLB

const GLB_JSON = 0x4e4f534a;
const GLB_BIN = 0x004e4942;

function glbChunk(type: number, data: Buffer, padByte: number): Buffer {
  const padding = (4 - (data.length % 4)) % 4;
  const padded = Buffer.concat([data, Buffer.alloc(padding, padByte)]);
  const header = Buffer.alloc(8);
  header.writeUInt32LE(padded.length, 0);
  header.writeUInt32LE(type, 4);
  return Buffer.concat([header, padded]);
}

export function defaultGltfJson(binLength = 12): Record<string, unknown> {
  return {
    asset: { version: '2.0', generator: 'ailabs-test' },
    buffers: [{ byteLength: binLength }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: binLength }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 1, type: 'VEC3' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
  };
}

export interface GlbOptions {
  json?: Record<string, unknown> | string;
  bin?: Buffer | null;
  version?: number;
  lengthDelta?: number;
  jsonChunkType?: number;
}

export function buildGlb(options: GlbOptions = {}): Buffer {
  const bin = options.bin === undefined ? Buffer.alloc(12, 0) : options.bin;
  const json = options.json ?? defaultGltfJson(bin ? bin.length : 0);
  const jsonText = typeof json === 'string' ? json : JSON.stringify(json);
  const chunks = [glbChunk(options.jsonChunkType ?? GLB_JSON, Buffer.from(jsonText, 'utf8'), 0x20)];
  if (bin) chunks.push(glbChunk(GLB_BIN, bin, 0x00));
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'latin1');
  header.writeUInt32LE(options.version ?? 2, 4);
  header.writeUInt32LE(12 + body.length + (options.lengthDelta ?? 0), 8);
  return Buffer.concat([header, body]);
}

/** GLB hợp lệ có tổng dung lượng đúng `totalBytes` (bội số của 4), đệm bằng chunk lạ được bỏ qua. */
export function buildGlbOfSize(totalBytes: number): Buffer {
  const base = buildGlb({ json: { asset: { version: '2.0' } }, bin: null });
  const paddingLength = totalBytes - base.length - 8;
  if (paddingLength < 0 || paddingLength % 4 !== 0) throw new Error('totalBytes không hợp lệ');
  const header = Buffer.alloc(8);
  header.writeUInt32LE(paddingLength, 0);
  header.write('XTRA', 4, 'latin1');
  const glb = Buffer.concat([base, header, Buffer.alloc(paddingLength, 0)]);
  glb.writeUInt32LE(glb.length, 8);
  return glb;
}

/** MP3 hợp lệ gồm số khung vừa đủ để vượt (hoặc chạm) `minBytes`. */
export function buildMp3OfAtLeast(minBytes: number): Buffer {
  return buildMp3({ frames: Math.ceil(minBytes / MP3_FRAME_LENGTH) });
}

// ---------------------------------------------------------------- WebVTT & khác

export function buildVtt(body?: string): Buffer {
  const text =
    body ??
    [
      'WEBVTT',
      '',
      'intro',
      '00:00:00.000 --> 00:00:02.500',
      'Xin chào quý khách.',
      '',
      '00:00:02.500 --> 00:01:05.000 align:start',
      'Hiện vật được phát hiện năm 1924.',
      '',
    ].join('\n');
  return Buffer.from(text, 'utf8');
}

export const SVG_FILE = Buffer.from(
  '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
  'utf8',
);

/** Header PE của file .exe Windows ("MZ"). */
export const EXE_FILE = Buffer.concat([Buffer.from('MZ', 'latin1'), Buffer.alloc(254, 0x90)]);
