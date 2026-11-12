import { createHash } from 'node:crypto';
import { open, lstat, realpath, mkdtemp, writeFile, rename, rm, readFile } from 'node:fs/promises';
import { basename, dirname, resolve, relative, sep, join } from 'node:path';
import { NodeIO, Logger } from '@gltf-transform/core';
import { KHRDracoMeshCompression, EXTTextureWebP } from '@gltf-transform/extensions';
import { draco, simplify } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { AssetError, inspectGlb, validateSpecification, LIMITS } from './validation.mjs';
import { primitiveList, primitiveGeometry, geometryMetrics, compareGeometry, lodUnsupported } from './geometry.mjs';
import { inspectImage, webpCandidate } from './images.mjs';

const SHA = (bytes) => createHash('sha256').update(bytes).digest('hex');
const DRACO = Object.freeze({ method: 'edgebreaker', encodeSpeed: 5, decodeSpeed: 5, quantizePosition: 20, quantizeNormal: 16, quantizeTexcoord: 16, quantizeColor: 16, quantizeGeneric: 16, quantizationVolume: 'mesh' });
const DEFAULT_LOD = [{ ratio: 0.8, error: 0.0005 }, { ratio: 0.5, error: 0.001 }];
let dependencies;

async function io() {
  dependencies ??= Promise.all([draco3d.createEncoderModule(), draco3d.createDecoderModule(), MeshoptSimplifier.ready]);
  const [encoder, decoder] = await dependencies;
  return new NodeIO().setLogger(new Logger(Logger.Verbosity.ERROR))
    .registerExtensions([KHRDracoMeshCompression, EXTTextureWebP])
    .registerDependencies({ 'draco3d.encoder': encoder, 'draco3d.decoder': decoder });
}

function configFor(options) {
  const config = { lod: options.lod ?? DEFAULT_LOD, boundsTolerance: options.boundsTolerance ?? 0.005, surfaceTolerance: options.surfaceTolerance ?? 0.005, embeddedWebp: options.embeddedWebp ?? false, imagePolicy: options.imagePolicy ?? 'detail', draco: DRACO, limits: LIMITS };
  if (!Array.isArray(config.lod) || config.lod.length !== 2 || config.lod.some((level) => !level || !Number.isFinite(level.ratio) || level.ratio <= 0 || level.ratio >= 1 || !Number.isFinite(level.error) || level.error <= 0 || level.error > 0.005 || Object.keys(level).some((key) => !['ratio', 'error'].includes(key)))) throw new AssetError('INVALID_CONFIG', 'LOD config needs two ratio/error targets, ratio in (0,1), error in (0,0.005]');
  if (config.lod[1].ratio > config.lod[0].ratio) throw new AssetError('INVALID_CONFIG', 'LOD2 ratio must not exceed LOD1 ratio');
  for (const key of ['boundsTolerance', 'surfaceTolerance']) if (!Number.isFinite(config[key]) || config[key] <= 0 || config[key] > 0.01) throw new AssetError('INVALID_CONFIG', `${key} config must be in (0,0.01]`);
  if (typeof config.embeddedWebp !== 'boolean' || !['photo', 'detail', 'data'].includes(config.imagePolicy)) throw new AssetError('INVALID_CONFIG', 'Invalid image config');
  return config;
}

async function readSource(path) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size === 0 || info.size > LIMITS.bytes) throw new AssetError('INVALID_INPUT', 'Source must be a regular file within the size limit');
  const handle = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(info.size + 1);
    let total = 0;
    while (total < buffer.length) {
      const { bytesRead } = await handle.read(buffer, total, buffer.length - total, total);
      if (bytesRead === 0) break;
      total += bytesRead;
    }
    if (total !== info.size) throw new AssetError('INVALID_INPUT', 'Source size changed during read');
    return buffer.subarray(0, total);
  } finally { await handle.close(); }
}

async function freshDestination(source, output) {
  if (typeof output !== 'string' || !output.trim()) throw new AssetError('INVALID_OUTPUT', 'A fresh output directory is required');
  if (output.split(/[\\/]/).includes('..')) throw new AssetError('INVALID_OUTPUT', 'Output path traversal is forbidden');
  const destination = resolve(output);
  const actualSource = await realpath(source);
  const relation = relative(destination, actualSource);
  if (relation === '' || (!relation.startsWith(`..${sep}`) && relation !== '..' && !relation.includes(':'))) throw new AssetError('INVALID_OUTPUT', 'Output cannot contain the source');
  try {
    await lstat(destination);
    throw new AssetError('INVALID_OUTPUT', 'Output already exists; choose a fresh directory');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const parent = await realpath(dirname(destination));
  if (resolve(parent, basename(destination)).toLowerCase() !== destination.toLowerCase()) throw new AssetError('INVALID_OUTPUT', 'Output parent must use its canonical path');
  return destination;
}

async function versions() {
  const packageNames = ['@gltf-transform/core', '@gltf-transform/extensions', '@gltf-transform/functions', 'draco3dgltf', 'meshoptimizer', 'sharp', 'gltf-validator'];
  const result = { pipeline: '1.0.0', node: process.versions.node, platform: process.platform, arch: process.arch, sharpNative: sharp.versions };
  for (const name of packageNames) result[name] = JSON.parse(await readFile(new URL(`../node_modules/${name}/package.json`, import.meta.url), 'utf8')).version;
  return result;
}

function manifestFor(source, bytes, config, toolVersions) {
  return { schemaVersion: 1, status: 'REVIEW_REQUIRED', visualQa: 'REVIEW_REQUIRED', publicationEligible: false, source: { file: basename(source), sha256: SHA(bytes), bytes: bytes.length }, config, configurationSha256: SHA(Buffer.from(JSON.stringify(config))), tools: toolVersions, artifacts: [], limitations: ['Human visual comparison with authorized museum assets is required before publication.', 'Sampled geometric surface distance does not prove silhouette, inscription, material, normal or hotspot fidelity.', 'Runtime loading, FPS, GPU memory and real-device behavior require separate application measurements.'] };
}

async function optimizeTextures(document) {
  const results = [];
  for (const texture of document.getRoot().listTextures()) {
    const original = Buffer.from(texture.getImage());
    const result = await webpCandidate(original, 'data', { embedded: true });
    if (result.unsupported || result.fallback) {
      results.push({ name: texture.getName(), status: 'ORIGINAL_RETAINED', reason: result.unsupported ?? result.reason, bytes: original.length });
      continue;
    }
    document.createExtension(EXTTextureWebP).setRequired(true);
    texture.setImage(result.bytes).setMimeType('image/webp');
    results.push({ name: texture.getName(), status: 'REVIEW_REQUIRED', originalBytes: original.length, bytes: result.bytes.length, quality: result.quality });
  }
  return results;
}

async function validateDocument(document) {
  for (const primitive of primitiveList(document)) {
    primitiveGeometry(primitive);
    for (const attribute of primitive.listAttributes()) if (Array.from(attribute.getArray()).some((value) => !Number.isFinite(value))) throw new AssetError('INVALID_INPUT', 'Non-finite attribute');
  }
  for (const texture of document.getRoot().listTextures()) await inspectImage(Buffer.from(texture.getImage()));
}

async function generateGlb(bytes, manifest, directory) {
  const validation = inspectGlb(bytes);
  if (validation.unsupported.length) {
    manifest.status = 'UNSUPPORTED';
    manifest.unsupported = validation.unsupported;
    return;
  }
  manifest.source.validation = await validateSpecification(bytes);
  const codec = await io();
  const original = await codec.readBinary(bytes);
  await validateDocument(original);
  manifest.source.metrics = geometryMetrics(original);
  const lodReason = lodUnsupported(original);
  manifest.lod = { status: lodReason ? 'LOD_NOT_GENERATED' : 'REVIEW_REQUIRED', reason: lodReason, policy: 'Per-model candidate targets. No level is automatically approved.' };
  for (const lod of [0, 1, 2]) {
    if (lod > 0 && lodReason) continue;
    const document = await codec.readBinary(bytes);
    if (lod > 0) await document.transform(simplify({ simplifier: MeshoptSimplifier, ...manifest.config.lod[lod - 1], lockBorder: true }));
    const textureConversion = manifest.config.embeddedWebp ? await optimizeTextures(document) : [];
    await document.transform(draco(DRACO));
    const encoded = Buffer.from(await codec.writeBinary(document));
    inspectGlb(encoded, { generated: true });
    const specification = await validateSpecification(encoded);
    const decoded = await codec.readBinary(encoded);
    await validateDocument(decoded);
    let quality;
    try {
      quality = compareGeometry(original, decoded, lod, manifest.config);
    } catch (error) {
      if (lod === 0 || error.code !== 'QUALITY_REJECTED') throw error;
      manifest.lod.status = 'LOD_NOT_GENERATED';
      manifest.lod.rejected ??= [];
      manifest.lod.rejected.push({ lod, status: 'REJECTED', code: error.code, reason: error.message });
      continue;
    }
    const metrics = geometryMetrics(decoded);
    if (lod > 0 && metrics.triangles >= manifest.source.metrics.triangles) {
      manifest.lod.rejected ??= [];
      manifest.lod.rejected.push({ lod, status: 'LOD_NOT_GENERATED', reason: 'Conservative simplification could not reduce triangles' });
      continue;
    }
    const file = `lod${lod}.glb`;
    await writeFile(join(directory, file), encoded, { flag: 'wx' });
    manifest.artifacts.push({ file, lod, status: 'REVIEW_REQUIRED', sha256: SHA(encoded), bytes: encoded.length, metrics, quality, specification, textureConversion });
  }
  if (manifest.artifacts.length < 3) manifest.lod.status = 'LOD_NOT_GENERATED';
}

async function generateImage(bytes, manifest, directory) {
  const result = await webpCandidate(bytes, manifest.config.imagePolicy);
  manifest.source.metrics = (await inspectImage(bytes)).metrics;
  if (result.unsupported) {
    manifest.status = 'UNSUPPORTED';
    manifest.unsupported = [result.unsupported];
    return;
  }
  const file = result.fallback ? `image-original.${result.metrics.format}` : 'image.webp';
  await writeFile(join(directory, file), result.bytes, { flag: 'wx' });
  manifest.artifacts.push({ file, status: 'REVIEW_REQUIRED', sha256: SHA(result.bytes), bytes: result.bytes.length, metrics: result.metrics, quality: result.quality, selection: result.fallback ? 'ORIGINAL_RETAINED' : 'WEBP_CANDIDATE', reason: result.reason ?? null });
}

export async function optimizeAsset(options) {
  if (!options || typeof options.source !== 'string') throw new AssetError('INVALID_INPUT', 'Source file is required');
  const config = configFor(options);
  const source = resolve(options.source);
  const destination = await freshDestination(source, options.output);
  const bytes = await readSource(source);
  const manifest = manifestFor(source, bytes, config, await versions());
  const temporary = await mkdtemp(join(dirname(destination), '.aura-assets-'));
  const lockPath = join(dirname(destination), `.${basename(destination)}.aura.lock`);
  let lock;
  try {
    lock = await open(lockPath, 'wx');
    try {
      await lstat(destination);
      throw new AssetError('INVALID_OUTPUT', 'Output already exists; choose a fresh directory');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (bytes.subarray(0, 4).toString() === 'glTF') await generateGlb(bytes, manifest, temporary);
    else await generateImage(bytes, manifest, temporary);
    if (SHA(await readSource(source)) !== manifest.source.sha256) throw new AssetError('SOURCE_CHANGED', 'Source changed during processing');
    await writeFile(join(temporary, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
    await rename(temporary, destination);
    return manifest;
  } finally {
    await rm(temporary, { recursive: true, force: true });
    if (lock) {
      await lock.close();
      await rm(lockPath);
    }
  }
}
