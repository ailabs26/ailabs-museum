/**
 * Task 28 (AC-33) — bộ sinh đầu vào fuzz cho upload media.
 *
 * Mọi giá trị ngẫu nhiên đi qua PRNG có seed (mulberry32), nên một lần chạy thất bại tái lập
 * được bằng `FUZZ_SEED=<seed in ra>`. Không dùng `Math.random`.
 */
import { MediaFormat } from '../inspection/media-formats';
import {
  EXE_FILE,
  SVG_FILE,
  buildGlb,
  buildJpeg,
  buildMp3,
  buildPng,
  buildVtt,
  buildWebp,
} from './media-test-files';

/** PRNG 32-bit có seed; đủ tốt cho fuzz, không dùng cho mật mã. */
export function createRng(seed: number) {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, maxInclusive: number): number => min + Math.floor(next() * (maxInclusive - min + 1));
  const pick = <T>(items: readonly T[]): T => items[int(0, items.length - 1)];
  const bytes = (length: number): Buffer => {
    const out = Buffer.alloc(length);
    for (let i = 0; i < length; i += 1) out[i] = int(0, 255);
    return out;
  };
  return { next, int, pick, bytes };
}

export type Rng = ReturnType<typeof createRng>;

/** File hợp lệ của từng định dạng — điểm xuất phát để đột biến. */
export const SEED_FILES: ReadonlyArray<{ format: MediaFormat; name: string; mime: string; build: () => Buffer }> = [
  { format: MediaFormat.PNG, name: 'anh.png', mime: 'image/png', build: () => buildPng() },
  { format: MediaFormat.JPEG, name: 'anh.jpg', mime: 'image/jpeg', build: () => buildJpeg() },
  { format: MediaFormat.WEBP, name: 'anh.webp', mime: 'image/webp', build: () => buildWebp('lossy') },
  { format: MediaFormat.GLB, name: 'mo-hinh.glb', mime: 'model/gltf-binary', build: () => buildGlb() },
  { format: MediaFormat.MP3, name: 'thuyet-minh.mp3', mime: 'audio/mpeg', build: () => buildMp3({ frames: 3 }) },
  {
    format: MediaFormat.VTT,
    name: 'phu-de.vtt',
    mime: 'text/vtt',
    build: () => buildVtt('WEBVTT\n\n00:00.000 --> 00:01.000\nXin chào\n\n00:01.000 --> 00:02.500\nTạm biệt\n'),
  },
];

/** Các chiến lược đột biến. Header (16 byte đầu) được nhắm riêng vì chứa magic bytes + độ dài. */
const MUTATORS: ReadonlyArray<{ name: string; apply: (input: Buffer, rng: Rng) => Buffer }> = [
  {
    name: 'flip-bytes',
    apply: (input, rng) => {
      const out = Buffer.from(input);
      for (let n = rng.int(1, 8); n > 0; n -= 1) out[rng.int(0, out.length - 1)] ^= 1 << rng.int(0, 7);
      return out;
    },
  },
  {
    name: 'flip-header',
    apply: (input, rng) => {
      const out = Buffer.from(input);
      out[rng.int(0, Math.min(15, out.length - 1))] = rng.int(0, 255);
      return out;
    },
  },
  { name: 'truncate', apply: (input, rng) => input.subarray(0, rng.int(1, Math.max(1, input.length - 1))) },
  {
    name: 'insert-random',
    apply: (input, rng) => {
      const at = rng.int(0, input.length);
      return Buffer.concat([input.subarray(0, at), rng.bytes(rng.int(1, 64)), input.subarray(at)]);
    },
  },
  {
    name: 'delete-range',
    apply: (input, rng) => {
      const start = rng.int(0, input.length - 1);
      return Buffer.concat([input.subarray(0, start), input.subarray(start + rng.int(1, 32))]);
    },
  },
  {
    name: 'duplicate-range',
    apply: (input, rng) => {
      const start = rng.int(0, input.length - 1);
      const slice = input.subarray(start, start + rng.int(1, 64));
      return Buffer.concat([input.subarray(0, start), slice, slice, input.subarray(start + slice.length)]);
    },
  },
  {
    name: 'u32-extreme',
    // Ghi đè một trường 32-bit (thường là độ dài chunk/header) bằng giá trị biên.
    apply: (input, rng) => {
      const out = Buffer.from(input);
      if (out.length < 4) return out;
      const value = rng.pick([0, 1, 0x7fffffff, 0x80000000, 0xffffffff, out.length, out.length + 1]);
      const offset = rng.int(0, out.length - 4);
      if (rng.next() < 0.5) out.writeUInt32LE(value >>> 0, offset);
      else out.writeUInt32BE(value >>> 0, offset);
      return out;
    },
  },
  {
    name: 'append-payload',
    apply: (input, rng) =>
      Buffer.concat([input, Buffer.from(rng.pick(['<script>alert(1)</script>', '<?php system($_GET[0]); ?>', '\0\0\0\0', 'MZ\x90\x00']), 'latin1')]),
  },
];

export interface FuzzCase {
  label: string;
  buffer: Buffer;
  filename: string;
  contentType: string;
}

/** Sinh `perFormat` biến thể đột biến cho mỗi định dạng (có thể đột biến chồng 1–3 lần). */
export function mutatedCases(seed: number, perFormat: number): FuzzCase[] {
  const rng = createRng(seed);
  const cases: FuzzCase[] = [];
  for (const file of SEED_FILES) {
    const original = file.build();
    for (let i = 0; i < perFormat; i += 1) {
      let buffer = original;
      const applied: string[] = [];
      for (let depth = rng.int(1, 3); depth > 0; depth -= 1) {
        const mutator = rng.pick(MUTATORS);
        buffer = mutator.apply(buffer, rng);
        applied.push(mutator.name);
      }
      cases.push({ label: `${file.format}#${i} ${applied.join('+')}`, buffer, filename: file.name, contentType: file.mime });
    }
  }
  return cases;
}

const HTML = Buffer.from('<!DOCTYPE html><html><body><script>alert(document.cookie)</script></body></html>');

/** File độc/đánh lừa viết tay — kết quả mong đợi luôn là bị từ chối (4xx). */
export const HOSTILE_FILES: readonly FuzzCase[] = [
  { label: 'exe đổi tên .png', buffer: EXE_FILE, filename: 'anh.png', contentType: 'image/png' },
  { label: 'exe đổi tên .glb', buffer: EXE_FILE, filename: 'model.glb', contentType: 'model/gltf-binary' },
  { label: 'svg có script khai báo png', buffer: SVG_FILE, filename: 'logo.png', contentType: 'image/png' },
  { label: 'html khai báo jpeg', buffer: HTML, filename: 'anh.jpg', contentType: 'image/jpeg' },
  { label: 'html có BOM + khoảng trắng', buffer: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('  \n'), HTML]), filename: 'x.vtt', contentType: 'text/vtt' },
  { label: 'php khai báo mp3', buffer: Buffer.from('<?php echo shell_exec($_GET["c"]); ?>'), filename: 'a.mp3', contentType: 'audio/mpeg' },
  { label: 'zip (PK) đổi tên .glb', buffer: Buffer.concat([Buffer.from('PK\x03\x04', 'latin1'), Buffer.alloc(60)]), filename: 'a.glb', contentType: 'model/gltf-binary' },
  { label: 'pdf đổi tên .png', buffer: Buffer.from('%PDF-1.7\n1 0 obj<<>>endobj\n%%EOF'), filename: 'a.png', contentType: 'image/png' },
  { label: 'gif89a (không được hỗ trợ)', buffer: Buffer.concat([Buffer.from('GIF89a', 'latin1'), Buffer.alloc(32)]), filename: 'a.gif', contentType: 'image/gif' },
  { label: 'ELF đổi tên .webp', buffer: Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(60)]), filename: 'a.webp', contentType: 'image/webp' },
  { label: '1 byte', buffer: Buffer.from([0x89]), filename: 'a.png', contentType: 'image/png' },
  { label: 'toàn byte 0', buffer: Buffer.alloc(4096), filename: 'a.glb', contentType: 'model/gltf-binary' },
  { label: 'toàn byte 0xFF', buffer: Buffer.alloc(4096, 0xff), filename: 'a.mp3', contentType: 'audio/mpeg' },
  { label: 'chỉ magic PNG', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), filename: 'a.png', contentType: 'image/png' },
  { label: 'chỉ magic GLB', buffer: Buffer.from('glTF', 'latin1'), filename: 'a.glb', contentType: 'model/gltf-binary' },
  { label: 'chỉ "WEBVTT"', buffer: Buffer.from('WEBVTT\n'), filename: 'a.vtt', contentType: 'text/vtt' },
  { label: 'vtt UTF-16', buffer: Buffer.from('﻿WEBVTT\n\n00:00.000 --> 00:01.000\nhi\n', 'utf16le'), filename: 'a.vtt', contentType: 'text/vtt' },
  { label: 'vtt chứa NUL', buffer: Buffer.from('WEBVTT\n\n00:00.000 --> 00:01.000\na\0b\n'), filename: 'a.vtt', contentType: 'text/vtt' },
  {
    label: 'GLB trỏ tài nguyên ngoài (uri http)',
    buffer: buildGlb({ json: { asset: { version: '2.0' }, buffers: [{ byteLength: 12, uri: 'https://evil.example/x.bin' }] } }),
    filename: 'a.glb',
    contentType: 'model/gltf-binary',
  },
  {
    label: 'GLB ảnh trỏ file:// cục bộ',
    buffer: buildGlb({ json: { asset: { version: '2.0' }, images: [{ uri: 'file:///etc/passwd' }] } }),
    filename: 'a.glb',
    contentType: 'model/gltf-binary',
  },
  {
    label: 'GLB JSON không phải object',
    buffer: buildGlb({ json: '[1, 2, 3]' }),
    filename: 'a.glb',
    contentType: 'model/gltf-binary',
  },
];

/** Tên file độc — nội dung luôn là PNG hợp lệ nên upload phải thành công với tên đã làm sạch. */
export const HOSTILE_FILENAMES: readonly string[] = [
  '../../../../etc/passwd.png',
  '..\\..\\windows\\system32\\a.png',
  '/abs/path/anh.png',
  'line\r\nX-Injected: 1.png',
  '‮gnp.exe',
  `${'a'.repeat(5000)}.png`,
  '   ',
  '.png',
  'ảnh hiện vật – đồ gốm 🏺.png',
  '<img src=x onerror=alert(1)>.png',
  'CON.png',
];
