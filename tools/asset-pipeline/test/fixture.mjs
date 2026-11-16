import { Document, NodeIO } from '@gltf-transform/core';
import sharp from 'sharp';
import { dirname, join } from 'node:path';
import { writeFile } from 'node:fs/promises';

/** Entirely synthetic CC0 test asset. Unit-radius sphere translated [2,0,-3]. */
export async function createFixture(path, segments = 32) {
  const document = new Document();
  const buffer = document.createBuffer();
  const positions = [];
  const normals = [];
  const texcoords = [];
  const indices = [];
  for (let row = 0; row <= segments; row++) {
    const latitude = Math.PI * row / segments;
    for (let col = 0; col <= segments * 2; col++) {
      const longitude = Math.PI * col / segments;
      const point = [Math.sin(latitude) * Math.cos(longitude), Math.cos(latitude), Math.sin(latitude) * Math.sin(longitude)];
      positions.push(...point);
      normals.push(...point);
      texcoords.push(col / (segments * 2), row / segments);
    }
  }
  const stride = segments * 2 + 1;
  for (let row = 0; row < segments; row++) {
    for (let col = 0; col < segments * 2; col++) {
      const start = row * stride + col;
      if (row !== 0) indices.push(start, start + 1, start + stride);
      if (row !== segments - 1) indices.push(start + 1, start + stride + 1, start + stride);
    }
  }
  const width = 128;
  const pixels = Buffer.alloc(width * width * 3);
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 3;
    const line = x % 16 < 2 || y % 16 < 2;
    pixels[index] = line ? 40 : 200 + (x % 16);
    pixels[index + 1] = line ? 25 : 120 + (y % 16);
    pixels[index + 2] = line ? 15 : 50;
  }
  const png = await sharp(pixels, { raw: { width, height: width, channels: 3 } }).png().toBuffer();
  const texture = document.createTexture('Synthetic inscription grid').setImage(png).setMimeType('image/png');
  const material = document.createMaterial('Museum ceramic').setBaseColorFactor([0.85, 0.65, 0.45, 1]).setRoughnessFactor(0.8).setBaseColorTexture(texture);
  const primitive = document.createPrimitive()
    .setAttribute('POSITION', document.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer))
    .setAttribute('NORMAL', document.createAccessor().setType('VEC3').setArray(new Float32Array(normals)).setBuffer(buffer))
    .setAttribute('TEXCOORD_0', document.createAccessor().setType('VEC2').setArray(new Float32Array(texcoords)).setBuffer(buffer))
    .setIndices(document.createAccessor().setType('SCALAR').setArray(new Uint16Array(indices)).setBuffer(buffer))
    .setMaterial(material);
  const mesh = document.createMesh('Synthetic sphere').addPrimitive(primitive);
  const node = document.createNode('Artifact').setMesh(mesh).setTranslation([2, 0, -3]);
  document.createScene('Museum fixture').addChild(node);
  await new NodeIO().write(path, document);
  await writeFile(join(dirname(path), 'source.png'), png);
  return path;
}
