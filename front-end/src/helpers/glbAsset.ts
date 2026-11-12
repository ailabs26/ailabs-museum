import type { BufferGeometry, Material, Mesh, Object3D, SkinnedMesh, Texture } from 'three';

const SUPPORTED_REQUIRED_EXTENSIONS = new Set([
  'KHR_lights_punctual', 'KHR_materials_clearcoat', 'KHR_materials_emissive_strength',
  'KHR_materials_ior', 'KHR_materials_iridescence', 'KHR_materials_sheen', 'KHR_materials_specular',
  'KHR_materials_transmission', 'KHR_materials_unlit', 'KHR_materials_volume', 'KHR_mesh_quantization',
  'KHR_texture_transform', 'EXT_texture_webp', 'EXT_mesh_gpu_instancing', 'KHR_materials_anisotropy',
  'KHR_draco_mesh_compression',
]);

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function nonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Draco accessors describe decoded data and may legitimately omit a bufferView. */
function validateDraco(json: Record<string, unknown>, binaryLength: number, fail: () => never): boolean {
  let usesDraco = false;
  let decodedByteLength = 0;
  const componentBytes = new Map([[5120, 1], [5121, 1], [5122, 2], [5123, 2], [5125, 4], [5126, 4]]);
  const typeComponents = new Map([['SCALAR', 1], ['VEC2', 2], ['VEC3', 3], ['VEC4', 4]]);
  const meshes = json.meshes ?? [];
  if (!Array.isArray(meshes)) return fail();
  for (const mesh of meshes) {
    if (!record(mesh) || !Array.isArray(mesh.primitives)) return fail();
    for (const primitive of mesh.primitives) {
      if (!record(primitive)) return fail();
      const extension = record(primitive.extensions) ? primitive.extensions.KHR_draco_mesh_compression : undefined;
      if (extension === undefined) continue;
      usesDraco = true;
      if (!record(extension) || !record(extension.attributes) || !record(primitive.attributes)
        || !nonnegativeInteger(extension.bufferView) || !Array.isArray(json.bufferViews)
        || !Array.isArray(json.accessors) || !Array.isArray(json.buffers) || json.buffers.length !== 1
        || !record(json.buffers[0]) || !nonnegativeInteger(json.buffers[0].byteLength)
        || json.buffers[0].byteLength > binaryLength || binaryLength - json.buffers[0].byteLength > 3
        || ![0, 4, undefined].includes(primitive.mode as number | undefined)) return fail();
      const bufferView = json.bufferViews[extension.bufferView] as unknown;
      if (!record(bufferView) || bufferView.buffer !== 0 || !nonnegativeInteger(bufferView.byteLength)
        || bufferView.byteLength === 0 || !nonnegativeInteger(bufferView.byteOffset ?? 0)
        || Number(bufferView.byteOffset ?? 0) + bufferView.byteLength > json.buffers[0].byteLength
        || bufferView.byteStride !== undefined) return fail();
      const attributes = Object.entries(extension.attributes);
      if (!attributes.length || !('POSITION' in extension.attributes)) return fail();
      const ids = new Set<number>();
      for (const [semantic, id] of attributes) {
        const accessorIndex = primitive.attributes[semantic];
        if (!nonnegativeInteger(id) || ids.has(id) || !nonnegativeInteger(accessorIndex)) return fail();
        ids.add(id);
        const accessor = json.accessors[accessorIndex] as unknown;
        if (!record(accessor) || !nonnegativeInteger(accessor.count) || accessor.count === 0 || accessor.count > 5_000_000
          || ![5120, 5121, 5122, 5123, 5125, 5126].includes(Number(accessor.componentType))
          || !['SCALAR', 'VEC2', 'VEC3', 'VEC4'].includes(String(accessor.type))
          || (semantic === 'POSITION' && (accessor.type !== 'VEC3' || accessor.componentType !== 5126))) return fail();
        decodedByteLength += accessor.count * componentBytes.get(Number(accessor.componentType))! * typeComponents.get(String(accessor.type))!;
      }
      if (primitive.indices !== undefined) {
        if (!nonnegativeInteger(primitive.indices)) return fail();
        const indices = json.accessors[primitive.indices] as unknown;
        if (!record(indices) || indices.type !== 'SCALAR' || ![5121, 5123, 5125].includes(Number(indices.componentType))
          || !nonnegativeInteger(indices.count) || indices.count === 0 || indices.count > 15_000_000) return fail();
        // Three's Draco decoder materializes triangle indices as Uint32Array.
        decodedByteLength += indices.count * 4;
      }
      if (decodedByteLength > 128 * 1024 * 1024) return fail();
    }
  }
  return usesDraco;
}

/** GLBs are untrusted. Refuse external dependencies before GLTFLoader can fetch. */
export function validateGlb(buffer: ArrayBuffer): { usesDraco: boolean } {
  const fail = (): never => { throw new Error('GLB bị hỏng hoặc dùng định dạng chưa hỗ trợ.'); };
  if (buffer.byteLength < 28 || buffer.byteLength > 128 * 1024 * 1024) return fail();
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2
    || view.getUint32(8, true) !== buffer.byteLength || view.getUint32(16, true) !== 0x4e4f534a) return fail();
  const length = view.getUint32(12, true);
  if (length % 4 || length > 16 * 1024 * 1024 || length + 20 > buffer.byteLength) return fail();
  let binaryLength = 0;
  let hasBinary = false;
  for (let offset = length + 20; offset < buffer.byteLength;) {
    if (offset + 8 > buffer.byteLength) return fail();
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    if (chunkLength % 4 || offset + 8 + chunkLength > buffer.byteLength || chunkType === 0x4e4f534a) return fail();
    if (chunkType === 0x004e4942) {
      if (hasBinary) return fail();
      hasBinary = true;
      binaryLength = chunkLength;
    }
    // The GLB specification permits unknown chunk types. Preserve legacy support.
    offset += 8 + chunkLength;
  }
  let json: Record<string, unknown>;
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, length)));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
    json = value as Record<string, unknown>;
  } catch { return fail(); }
  for (const kind of ['buffers', 'images']) {
    if (json[kind] === undefined) continue;
    if (!Array.isArray(json[kind])) return fail();
    for (const item of json[kind]) if (!item || typeof item !== 'object' || 'uri' in item) return fail();
  }
  for (const kind of ['extensionsUsed', 'extensionsRequired']) {
    if (json[kind] === undefined) continue;
    if (!Array.isArray(json[kind]) || json[kind].some((extension: unknown) => typeof extension !== 'string')) return fail();
  }
  const required = (json.extensionsRequired ?? []) as string[];
  const used = (json.extensionsUsed ?? []) as string[];
  if (required.some((extension) => !SUPPORTED_REQUIRED_EXTENSIONS.has(extension))
    || used.some((extension) => ['EXT_meshopt_compression', 'KHR_texture_basisu'].includes(extension))) return fail();
  const usesDraco = validateDraco(json, binaryLength, fail);
  if (usesDraco && !used.includes('KHR_draco_mesh_compression')) return fail();
  return { usesDraco };
}

/** Only the room asset owner calls this, after all primitive instances detach. */
export function disposeModel(scenes: readonly Object3D[]): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const images = new Set<unknown>();
  for (const scene of scenes) scene.traverse((object) => {
    const mesh = object as Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
    const skeleton = (object as SkinnedMesh).skeleton;
    if (skeleton?.boneTexture) textures.add(skeleton.boneTexture);
  });
  for (const material of materials) for (const value of Object.values(material) as unknown[]) {
    if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as Texture);
  }
  for (const texture of textures) {
    images.add(texture.source.data); texture.dispose();
  }
  for (const image of images) if (image && typeof image === 'object' && 'close' in image && typeof image.close === 'function') image.close();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}
