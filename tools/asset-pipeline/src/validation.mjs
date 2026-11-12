export class AssetError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export const LIMITS = Object.freeze({ bytes: 128 * 1024 * 1024, pixels: 32 * 1024 * 1024, vertices: 500_000, triangles: 500_000, nodes: 10_000, jsonBytes: 8 * 1024 * 1024 });

function requireValid(condition, message) {
  if (!condition) throw new AssetError('INVALID_INPUT', message);
}

function integer(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function array(document, key) {
  const value = document[key] ?? [];
  requireValid(Array.isArray(value), `${key} must be an array`);
  return value;
}

/** Runs before NodeIO. No URI of any kind is permitted in an offline GLB. */
export function inspectGlb(bytes, { generated = false } = {}) {
  requireValid(bytes.length >= 28 && bytes.length <= LIMITS.bytes, 'GLB size outside supported range');
  requireValid(bytes.readUInt32LE(0) === 0x46546c67 && bytes.readUInt32LE(4) === 2 && bytes.readUInt32LE(8) === bytes.length, 'Invalid GLB header');
  let document;
  let bin;
  let offset = 12;
  let chunk = 0;
  while (offset < bytes.length) {
    requireValid(offset + 8 <= bytes.length, 'Truncated chunk header');
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    requireValid(length % 4 === 0 && offset + 8 + length <= bytes.length, 'Invalid chunk length');
    const content = bytes.subarray(offset + 8, offset + 8 + length);
    if (chunk === 0) {
      requireValid(type === 0x4e4f534a && length <= LIMITS.jsonBytes, 'Missing or excessive JSON chunk');
      try {
        document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(content));
      } catch {
        throw new AssetError('INVALID_INPUT', 'Invalid GLB JSON');
      }
    } else {
      requireValid(chunk === 1 && type === 0x004e4942, 'Only one embedded BIN chunk supported');
      bin = content;
    }
    offset += length + 8;
    chunk++;
  }
  requireValid(document && typeof document === 'object' && document.asset?.version === '2.0', 'Expected glTF 2.0');
  const unsupported = [];
  const permitted = generated ? ['KHR_draco_mesh_compression', 'EXT_texture_webp'] : [];
  for (const field of ['extensionsUsed', 'extensionsRequired']) {
    for (const extension of array(document, field)) {
      requireValid(typeof extension === 'string', 'Invalid extension name');
      if (!permitted.includes(extension)) unsupported.push(`Extension ${extension}`);
    }
  }
  // Detect unlisted extension payloads as well. Unsupported extensions must never be silently discarded.
  function inspectTree(value, depth = 0) {
    requireValid(depth <= 64, 'Excessive JSON nesting');
    if (!value || typeof value !== 'object') return;
    requireValid(!('uri' in value), 'External and data URI resources are forbidden');
    if (value.extensions) {
      for (const extension of Object.keys(value.extensions)) if (!permitted.includes(extension)) unsupported.push(`Extension ${extension}`);
    }
    for (const child of Object.values(value)) inspectTree(child, depth + 1);
  }
  inspectTree(document);
  const buffers = array(document, 'buffers');
  requireValid(buffers.length === 1 && bin && integer(buffers[0].byteLength) && buffers[0].byteLength > 0 && buffers[0].byteLength <= bin.length, 'Expected one embedded buffer');
  const views = array(document, 'bufferViews');
  for (const view of views) {
    requireValid(view.buffer === 0 && integer(view.byteOffset ?? 0) && integer(view.byteLength) && view.byteLength > 0 && (view.byteOffset ?? 0) + view.byteLength <= buffers[0].byteLength, 'Invalid bufferView');
    if (view.byteStride !== undefined) requireValid(integer(view.byteStride) && view.byteStride >= 4 && view.byteStride <= 252 && view.byteStride % 4 === 0, 'Invalid byteStride');
  }
  const accessors = array(document, 'accessors');
  const widths = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
  const componentBytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  for (const accessor of accessors) {
    requireValid(integer(accessor.count) && accessor.count > 0 && accessor.count <= LIMITS.triangles * 3 && widths[accessor.type] && componentBytes[accessor.componentType], 'Invalid or excessive accessor');
    requireValid(integer(accessor.byteOffset ?? 0), 'Invalid accessor offset');
    if (accessor.sparse) unsupported.push('Sparse accessors');
    if (accessor.bufferView !== undefined) {
      const view = views[accessor.bufferView];
      requireValid(integer(accessor.bufferView) && view, 'Invalid accessor bufferView');
      const elementBytes = widths[accessor.type] * componentBytes[accessor.componentType];
      const stride = view.byteStride ?? elementBytes;
      requireValid(stride >= elementBytes && (accessor.byteOffset ?? 0) + (accessor.count - 1) * stride + elementBytes <= view.byteLength, 'Accessor exceeds bufferView');
    } else requireValid(generated || accessor.sparse || unsupported.length > 0, 'Accessor lacks data');
  }
  for (const image of array(document, 'images')) {
    requireValid(integer(image.bufferView) && views[image.bufferView], 'Image must use an embedded bufferView');
    requireValid(['image/png', 'image/jpeg', ...((generated || document.extensionsUsed?.includes('EXT_texture_webp')) ? ['image/webp'] : [])].includes(image.mimeType), 'Unsupported embedded image format');
  }
  const nodes = array(document, 'nodes');
  requireValid(nodes.length <= LIMITS.nodes, 'Excessive node count');
  const parents = new Map();
  function visit(index, active) {
    requireValid(integer(index) && nodes[index] && !active.has(index) && active.size < 128, 'Invalid, cyclic or excessively deep hierarchy');
    const next = new Set(active).add(index);
    for (const child of array(nodes[index], 'children')) {
      requireValid(!parents.has(child), 'Node has multiple parents');
      parents.set(child, index);
      visit(child, next);
    }
  }
  const childNodes = new Set(nodes.flatMap((node) => array(node, 'children')));
  nodes.forEach((node, index) => {
    for (const [key, length] of [['matrix', 16], ['translation', 3], ['rotation', 4], ['scale', 3]]) {
      if (node[key] !== undefined) requireValid(Array.isArray(node[key]) && node[key].length === length && node[key].every(Number.isFinite), `Invalid node ${key}`);
    }
    if (node.skin !== undefined) unsupported.push('Skinning');
    if (node.camera !== undefined) unsupported.push('Camera');
    if (!childNodes.has(index)) visit(index, new Set());
  });
  requireValid(parents.size === childNodes.size, 'Cyclic hierarchy');
  for (const scene of array(document, 'scenes')) {
    for (const index of array(scene, 'nodes')) requireValid(integer(index) && nodes[index] && !childNodes.has(index), 'Invalid scene root');
  }
  for (const key of ['animations', 'skins', 'cameras']) if (array(document, key).length) unsupported.push(key);
  const meshes = array(document, 'meshes');
  requireValid(meshes.length > 0, 'No mesh geometry');
  let vertexCount = 0;
  let triangleCount = 0;
  for (const mesh of meshes) {
    requireValid(array(mesh, 'primitives').length > 0, 'Empty mesh');
    if (mesh.weights) unsupported.push('Morph weights');
    for (const primitive of mesh.primitives) {
      if ((primitive.mode ?? 4) !== 4) unsupported.push('Non-triangle primitive');
      if (primitive.targets?.length) unsupported.push('Morph targets');
      const position = accessors[primitive.attributes?.POSITION];
      requireValid(position?.type === 'VEC3' && position.componentType === 5126 && position.count <= LIMITS.vertices, 'Invalid POSITION accessor');
      for (const [semantic, index] of Object.entries(primitive.attributes ?? {})) {
        const attribute = accessors[index];
        requireValid(integer(index) && attribute?.count === position.count, 'Invalid primitive attribute');
        if (!['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0', 'TEXCOORD_1', 'COLOR_0'].includes(semantic)) unsupported.push(`Attribute ${semantic}`);
      }
      const indices = accessors[primitive.indices];
      if (primitive.indices !== undefined) requireValid(integer(primitive.indices) && indices?.type === 'SCALAR' && [5121, 5123, 5125].includes(indices.componentType), 'Invalid indices');
      const count = indices?.count ?? position.count;
      requireValid(count % 3 === 0, 'Invalid triangle count');
      vertexCount += position.count;
      triangleCount += count / 3;
    }
  }
  requireValid(vertexCount <= LIMITS.vertices && triangleCount <= LIMITS.triangles, 'Geometry exceeds supported processing limits');
  return { document, unsupported: [...new Set(unsupported)] };
}

export function detectImage(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpeg';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'webp';
  throw new AssetError('INVALID_INPUT', 'Only PNG, JPEG and WebP image bytes are accepted');
}
import validator from 'gltf-validator';


export async function validateSpecification(bytes) {
  const report = await validator.validateBytes(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength), {
    format: 'glb',
    writeTimestamp: false,
    maxIssues: 100,
    severityOverrides: { ACCESSOR_INDEX_TRIANGLE_DEGENERATE: 0 },
    externalResourceFunction: async () => { throw new AssetError('INVALID_INPUT', 'External resource requested by glTF validator'); },
  });
  if (report.issues.numErrors > 0) throw new AssetError('INVALID_INPUT', `glTF specification validation failed (${report.issues.messages.filter((issue) => issue.severity === 0).map((issue) => issue.code).join(', ')})`);
  return report.issues;
}
