import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';
import { installMuseumApi, fulfillMuseum } from './museumApi';
import { envelope, roomA } from './museumContent';

/** Small self-contained, genuinely parsed GLB. Test fixture only; never a production asset. */
export function createMuseumGlb(tag: string, invalidMesh = false, brokenAccessor = false) {
  const vertices = new Float32Array([-0.5, 0, -0.5, 0.5, 0, -0.5, 0, 1, 0, -0.5, 0, 0.5, 0.5, 0, 0.5, 0, 1, 0]);
  const bad = new Float32Array(vertices); bad[0] = NaN;
  const binary = Buffer.concat([Buffer.from(vertices.buffer), ...(invalidMesh ? [Buffer.from(bad.buffer)] : [])]);
  const json = { asset: { version: '2.0', generator: tag }, scene: 0, scenes: [{ name: `source-${tag}`, nodes: invalidMesh ? [0, 1] : [0] }],
    nodes: [{ mesh: 0 }, ...(invalidMesh ? [{ mesh: 1, translation: [0.1, 0, 0] }] : [])],
    meshes: [{ primitives: [{ attributes: { POSITION: brokenAccessor ? 99 : 0 }, material: 0 }] }, ...(invalidMesh ? [{ primitives: [{ attributes: { POSITION: 1 }, material: 0 }] }] : [])],
    materials: [{ doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [0.25, 0.55, 0.45, 1], metallicFactor: 0, roughnessFactor: 0.8 } }],
    buffers: [{ byteLength: binary.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: vertices.byteLength }, ...(invalidMesh ? [{ buffer: 0, byteOffset: vertices.byteLength, byteLength: bad.byteLength }] : [])],
    accessors: [{ bufferView: 0, componentType: 5126, count: 6, type: 'VEC3', min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] },
      ...(invalidMesh ? [{ bufferView: 1, componentType: 5126, count: 6, type: 'VEC3', min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] }] : [])] };
  const content = Buffer.from(JSON.stringify(json)); const padded = Buffer.alloc(Math.ceil(content.length / 4) * 4, 32); content.copy(padded);
  const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + padded.length + binary.length, 8);
  header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(binary.length); binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, padded, binHeader, binary]);
}

export async function installFiveModels(page: Page, options: { failIndex?: number; failure?: number | 'network' | 'corrupt'; invalidMesh?: boolean; brokenAccessor?: boolean; gate?: Promise<void> } = {}) {
  await installMuseumApi(page);
  const binaries = roomA.exhibits.map((_, i) => createMuseumGlb(String(i), options.invalidMesh && i === 1, options.brokenAccessor && i === 1));
  const requests = Array<number>(5).fill(0);
  const exhibits = roomA.exhibits.map((item, i) => {
    const checksum = createHash('sha256').update(binaries[i]).digest('hex');
    return { ...item, positionX: [-3.6, 0, 3.6, -1.8, 1.8][i], positionZ: [-2, -2, -2, 2, 2][i],
      model: { id: item.id, checksumSha256: checksum, storageKey: `models/test-${i}.glb`, sizeBytes: binaries[i].length,
        url: `/rooms/sculpture/exhibits/${item.id}/model?version=${checksum}` } };
  });
  await page.route('**/api/rooms/sculpture', route => fulfillMuseum(route, envelope({ ...roomA, exhibits })));
  await page.route('**/api/rooms/sculpture/exhibits/*/model?*', async route => {
    const index = exhibits.findIndex(item => route.request().url().includes(item.id)); requests[index]++;
    await options.gate;
    if (index === options.failIndex && requests[index] === 1) {
      if (options.failure === 'network') return route.abort('failed');
      if (options.failure !== 'corrupt') return fulfillMuseum(route, { success: false, data: null, message: 'Controlled failure' }, options.failure ?? 404);
    }
    return route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: index === options.failIndex && requests[index] === 1 ? Buffer.alloc(binaries[index].length) : binaries[index],
      headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4173', 'Access-Control-Allow-Credentials': 'true' } });
  });
  return { exhibits, requests };
}
