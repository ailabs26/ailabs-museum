import type { BufferGeometry, Material, Mesh, Object3D, SkinnedMesh, Texture } from 'three';

const SUPPORTED_REQUIRED_EXTENSIONS = new Set([
  'KHR_lights_punctual', 'KHR_materials_clearcoat', 'KHR_materials_emissive_strength',
  'KHR_materials_ior', 'KHR_materials_iridescence', 'KHR_materials_sheen', 'KHR_materials_specular',
  'KHR_materials_transmission', 'KHR_materials_unlit', 'KHR_materials_volume', 'KHR_mesh_quantization',
  'KHR_texture_transform', 'EXT_texture_webp', 'EXT_mesh_gpu_instancing', 'KHR_materials_anisotropy',
]);

/** GLBs are untrusted. Refuse external dependencies before GLTFLoader can fetch. */
export function validateGlb(buffer: ArrayBuffer): void {
  const fail = () => { throw new Error('GLB bị hỏng hoặc dùng định dạng chưa hỗ trợ.'); };
  if (buffer.byteLength < 28 || buffer.byteLength > 128 * 1024 * 1024) return fail();
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2
    || view.getUint32(8, true) !== buffer.byteLength || view.getUint32(16, true) !== 0x4e4f534a) return fail();
  const length = view.getUint32(12, true);
  if (length % 4 || length > 16 * 1024 * 1024 || length + 20 > buffer.byteLength) return fail();
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
    || used.some((extension) => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'].includes(extension))) return fail();
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
