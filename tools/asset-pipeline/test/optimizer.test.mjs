import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm, readdir, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { createFixture } from './fixture.mjs';
const temporaryRoot = fileURLToPath(new URL('../.tmp/', import.meta.url));
await mkdir(temporaryRoot, { recursive: true });
const tmpdir = () => temporaryRoot;
import { join } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { optimizeAsset } from '../src/optimizer.mjs';
import { compareGeometry } from '../src/geometry.mjs';

test('real GLB produces three decoded Draco review candidates without changing original', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aura-assets-'));
  try {
    const source = join(directory, 'original.glb');
    await createFixture(source);
    const before = await readFile(source);
    const result = await optimizeAsset({ source, output: join(directory, 'candidate') });
    assert.equal(result?.status, 'REVIEW_REQUIRED');
    assert.equal(result.artifacts.length, 3);
    assert.deepEqual(await readFile(source), before);
    assert.equal(result.artifacts[0].metrics.triangles, result.source.metrics.triangles);
    assert.ok(result.artifacts[2].metrics.triangles < result.source.metrics.triangles);
    for (const artifact of result.artifacts) {
      const bytes = await readFile(join(directory, 'candidate', artifact.file));
      assert.equal(artifact.sha256, createHash('sha256').update(bytes).digest('hex'));
      assert.equal(artifact.bytes, bytes.length);
      assert.equal(artifact.quality.visual, 'REVIEW_REQUIRED');
      assert.ok(artifact.quality.relativeSurfaceError <= 0.005);
    }
    assert.deepEqual(JSON.parse(await readFile(join(directory, 'candidate', 'manifest.json'), 'utf8')), result);
    const second = await optimizeAsset({ source, output: join(directory, 'second') });
    assert.deepEqual(second, result, 'metadata and compressed output must be reproducible');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects empty, malformed and oversized sources without output', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aura-invalid-'));
  try {
    const source = join(directory, 'source.glb');
    const output = join(directory, 'output');
    for (const bytes of [Buffer.alloc(0), Buffer.from('invalid')]) {
      await writeFile(source, bytes);
      await assert.rejects(optimizeAsset({ source, output }), /size|format|Invalid|Only/);
      await assert.rejects(stat(output), { code: 'ENOENT' });
    }
    await writeFile(source, Buffer.alloc(129 * 1024 * 1024));
    await assert.rejects(optimizeAsset({ source, output }), /size/i);
    assert.deepEqual(await readdir(directory), ['source.glb']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('fresh output required and source ancestor collisions cannot overwrite originals', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aura-collision-'));
  try {
    const source = join(directory, 'source.glb');
    await createFixture(source, 8);
    const original = await readFile(source);
    await assert.rejects(optimizeAsset({ source, output: directory }), /exist|source/i);
    await assert.rejects(optimizeAsset({ source, output: source }), /exist|source/i);
    await assert.rejects(optimizeAsset({ source, output: directory + '/../../unsafe' }), /traversal/i);
    assert.deepEqual(await readFile(source), original);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

function replaceJson(bytes, mutate) {
  const length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length).toString());
  mutate(json);
  const text = Buffer.from(JSON.stringify(json));
  const padded = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32);
  text.copy(padded);
  const result = Buffer.concat([bytes.subarray(0, 12), Buffer.alloc(8), padded, bytes.subarray(20 + length)]);
  result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12);
  result.writeUInt32LE(0x4e4f534a, 16);
  return result;
}

test('unsupported features are reported and unsafe external resources are rejected before decoding', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aura-unsupported-'));
  try {
    const source = join(directory, 'source.glb');
    await createFixture(source, 8);
    const bytes = await readFile(source);
    for (const mutate of [
      (json) => { json.extensionsUsed = ['KHR_materials_unlit']; },
      (json) => { json.animations = [{}]; },
      (json) => { json.meshes[0].primitives[0].targets = [{}]; },
    ]) {
      await writeFile(source, replaceJson(bytes, mutate));
      const output = join(directory, `candidate-${(await readdir(directory)).length}`);
      const result = await optimizeAsset({ source, output });
      assert.equal(result.status, 'UNSUPPORTED');
      assert.equal(result.artifacts.length, 0);
      assert.deepEqual(await readdir(output), ['manifest.json']);
    }
    await writeFile(source, replaceJson(bytes, (json) => { json.buffers[0].uri = '../../secret.bin'; }));
    await assert.rejects(optimizeAsset({ source, output: join(directory, 'unsafe') }), /URI|resource/i);
    await assert.rejects(stat(join(directory, 'unsafe')), { code: 'ENOENT' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('lossless WebP preserves alpha and exact oriented pixels, with original fallback for bigger candidates', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aura-webp-'));
  try {
    const source = join(directory, 'source.png');
    const input = await sharp({ create: { width: 128, height: 128, channels: 4, background: { r: 31, g: 93, b: 147, alpha: 0.4 } } }).png().toBuffer();
    await writeFile(source, input);
    const result = await optimizeAsset({ source, output: join(directory, 'candidate'), imagePolicy: 'detail' });
    assert.equal(result.status, 'REVIEW_REQUIRED');
    assert.equal(result.artifacts[0].quality.pixelExact, true);
    const output = await readFile(join(directory, 'candidate', result.artifacts[0].file));
    assert.deepEqual(await sharp(output).ensureAlpha().raw().toBuffer(), await sharp(input).ensureAlpha().raw().toBuffer());
    assert.ok(result.artifacts[0].bytes <= input.length);
    assert.equal(result.artifacts[0].metrics.hasAlpha, true);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('invalid config and decompression pixel limit fail before artifact generation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aura-config-'));
  try {
    const source = join(directory, 'source.glb');
    await createFixture(source, 8);
    await assert.rejects(optimizeAsset({ source, output: join(directory, 'output'), lod: [{ ratio: 1.2, error: 0.1 }] }), /config|ratio/i);
    await assert.rejects(stat(join(directory, 'output')), { code: 'ENOENT' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('quality gate catches changed UV and normals even when bounds and triangles match', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aura-attributes-'));
  try {
    const source = join(directory, 'source.glb');
    await createFixture(source, 8);
    const original = await new NodeIO().read(source);
    for (const semantic of ['NORMAL', 'TEXCOORD_0']) {
      const changed = await new NodeIO().read(source);
      const attribute = changed.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute(semantic);
      attribute.setElement(10, semantic === 'NORMAL' ? [1, 0, 0] : [0.3333, 0.9876]);
      assert.throws(() => compareGeometry(original, changed, 0, { boundsTolerance: 0.005, surfaceTolerance: 0.005 }), /attribute|normal|UV/i);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('failed validation cleans temporary files and concurrent output selection has one winner', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aura-cleanup-'));
  try {
    const source = join(directory, 'source.glb');
    await createFixture(source, 8);
    const valid = await readFile(source);
    await writeFile(source, replaceJson(valid, (json) => { const accessor = json.accessors[json.meshes[0].primitives[0].attributes.POSITION]; json.bufferViews[accessor.bufferView].byteLength = 1; }));
    await assert.rejects(optimizeAsset({ source, output: join(directory, 'broken') }), /bufferView/i);
    assert.deepEqual((await readdir(directory)).sort(), ['source.glb', 'source.png']);
    await writeFile(source, valid);
    const output = join(directory, 'concurrent');
    const results = await Promise.allSettled([optimizeAsset({ source, output }), optimizeAsset({ source, output })]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8')).status, 'REVIEW_REQUIRED');
    assert.deepEqual((await readdir(directory)).sort(), ['concurrent', 'source.glb', 'source.png']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('embedded WebP is opt-in, lossless, and preserves noncolor texture bytes after decoding', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aura-embedded-'));
  try {
    const source = join(directory, 'source.glb');
    await createFixture(source);
    const result = await optimizeAsset({ source, output: join(directory, 'candidate'), embeddedWebp: true });
    assert.ok(result.artifacts[0].textureConversion.length > 0);
    const conversion = result.artifacts[0].textureConversion[0];
    assert.equal(conversion.status, 'REVIEW_REQUIRED');
    assert.equal(conversion.quality.pixelExact, true);
    assert.equal(result.artifacts[0].metrics.textures[0].mimeType, 'image/webp');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('glTF spec-invalid material factors are rejected before NodeIO and output cleanup is complete', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aura-spec-'));
  try {
    const source = join(directory, 'source.glb');
    await createFixture(source, 8);
    const bytes = await readFile(source);
    await writeFile(source, replaceJson(bytes, (json) => { json.materials[0].pbrMetallicRoughness.roughnessFactor = 2; }));
    await assert.rejects(optimizeAsset({ source, output: join(directory, 'candidate') }), /specification|glTF|roughness/i);
    assert.deepEqual((await readdir(directory)).sort(), ['source.glb', 'source.png']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
