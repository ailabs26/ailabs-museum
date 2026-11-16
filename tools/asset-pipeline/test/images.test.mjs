import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { inspectImage, webpCandidate } from '../src/images.mjs';

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([typeBytes, data])) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8);
  return chunk;
}

async function createAnimatedPng() {
  const frames = await Promise.all(['red', 'blue'].map((background) => sharp({ create: { width: 64, height: 64, channels: 3, background } }).png().toBuffer()));
  const imageData = frames.map((frame) => {
    const data = [];
    for (let offset = 8; offset < frame.length;) {
      const length = frame.readUInt32BE(offset);
      if (frame.toString('ascii', offset + 4, offset + 8) === 'IDAT') data.push(frame.subarray(offset + 8, offset + 8 + length));
      offset += length + 12;
    }
    return Buffer.concat(data);
  });
  const animationControl = Buffer.alloc(8);
  animationControl.writeUInt32BE(2, 0);
  const controls = [0, 1].map((sequence) => {
    const control = Buffer.alloc(26);
    control.writeUInt32BE(sequence, 0);
    control.writeUInt32BE(64, 4);
    control.writeUInt32BE(64, 8);
    control.writeUInt16BE(1, 20);
    control.writeUInt16BE(10, 22);
    return control;
  });
  const secondFrame = Buffer.alloc(4 + imageData[1].length);
  secondFrame.writeUInt32BE(2, 0);
  imageData[1].copy(secondFrame, 4);
  return Buffer.concat([
    frames[0].subarray(0, 33),
    pngChunk('acTL', animationControl),
    pngChunk('fcTL', controls[0]),
    pngChunk('IDAT', imageData[0]),
    pngChunk('fcTL', controls[1]),
    pngChunk('fdAT', secondFrame),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

test('photo JPEG candidate preserves orientation and dimensions with measured color error', async () => {
  const pixels = Buffer.alloc(512 * 256 * 3);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 512; x++) {
    const index = (y * 512 + x) * 3;
    pixels[index] = Math.floor(x / 2);
    pixels[index + 1] = y;
    pixels[index + 2] = Math.floor((Math.sin(x / 16) + 1) * 80);
  }
  const jpeg = await sharp(pixels, { raw: { width: 512, height: 256, channels: 3 } }).jpeg({ quality: 100 }).toBuffer();
  // Minimal EXIF orientation=6, without adding an ICC profile to this synthetic JPEG.
  const exif = Buffer.from('ffe1002245786966000049492a0008000000010012010300010000000600000000000000', 'hex');
  const original = Buffer.concat([jpeg.subarray(0, 2), exif, jpeg.subarray(2)]);
  const result = await webpCandidate(original, 'photo');
  assert.equal(result.fallback, undefined);
  assert.equal(result.quality.lossless, false);
  assert.equal(result.quality.orientationApplied, 6);
  assert.equal(result.metrics.width, 256);
  assert.equal(result.metrics.height, 512);
  assert.ok(result.quality.psnrDb >= 38);
  assert.ok(result.bytes.length < original.length);
});

test('normal and roughness channel data remain pixel-exact in lossless WebP', async () => {
  const pixels = Buffer.alloc(128 * 128 * 3);
  for (let index = 0; index < pixels.length; index += 3) {
    pixels[index] = 128 + ((index / 3) % 3);
    pixels[index + 1] = 127;
    pixels[index + 2] = 255;
  }
  const original = await sharp(pixels, { raw: { width: 128, height: 128, channels: 3 } }).png().toBuffer();
  const result = await webpCandidate(original, 'data', { embedded: true });
  assert.equal(result.quality.pixelExact, true);
  assert.deepEqual(await sharp(result.bytes).raw().toBuffer(), pixels);
});

test('ICC input is reported unsupported and larger WebP candidates retain original', async () => {
  const profiled = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'red' } }).png().withIccProfile('srgb').toBuffer();
  assert.match((await webpCandidate(profiled, 'detail')).unsupported, /ICC/);
  const original = await sharp({ create: { width: 1, height: 1, channels: 3, background: 'red' } }).webp({ lossless: true }).toBuffer();
  const result = await webpCandidate(original, 'detail');
  assert.equal(result.fallback, true);
  assert.deepEqual(result.bytes, original);
});

test('malformed images, unsupported bytes and excessive decoded pixel counts are rejected', async () => {
  await assert.rejects(inspectImage(Buffer.from('GIF89a')), /Only PNG/);
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer();
  png.writeUInt32BE(100000, 16);
  png.writeUInt32BE(100000, 20);
  await assert.rejects(inspectImage(png));
  await assert.rejects(inspectImage(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
});

test('genuine two-frame APNG is unsupported even when Sharp omits its page count', async () => {
  const bytes = await createAnimatedPng();
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, 64);
  assert.equal(metadata.height, 64);
  assert.equal(metadata.pages, undefined, 'pinned Sharp sees only the default PNG frame');
  const result = await webpCandidate(bytes, 'detail');
  assert.match(result.unsupported ?? '', /Animated/);
  assert.equal(result.bytes, undefined, 'animated input must not become a static candidate');
  const embedded = await webpCandidate(bytes, 'data', { embedded: true });
  assert.match(embedded.unsupported ?? '', /Animated/);
});

test('truncated PNG chunks are rejected before Sharp can accept the default frame', async () => {
  const bytes = await createAnimatedPng();
  // The complete first frame remains readable, while fdAT extends beyond the file.
  const marker = bytes.indexOf(Buffer.from('fdAT'));
  bytes.writeUInt32BE(bytes.length, marker - 4);
  await assert.rejects(inspectImage(bytes), /PNG chunk/);
  const truncatedHeader = bytes.subarray(0, bytes.indexOf(Buffer.from('IEND')) - 4 + 3);
  await assert.rejects(inspectImage(truncatedHeader), /PNG chunk/);
});
