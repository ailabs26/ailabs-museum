import {
  Box3,
  Vector3,
  type BufferAttribute,
  type BufferGeometry,
  type Color,
  type InstancedMesh,
  type InterleavedBufferAttribute,
  type Material,
  type Mesh,
  type Object3D,
  type SkinnedMesh,
  type Texture,
} from 'three';
import { MAX_GLB_BYTES } from './glbSchema';

/**
 * Bộ kiểm tra nhị phân GLB, lọc mesh độc hại/hỏng, chuẩn hóa kích thước và giải phóng GPU
 * cho Mobile 3D Engine — port trực tiếp từ `front-end/src/helpers/{glbAsset,sanitizeModel,modelNormalization}.ts`
 * (MOB-E6-02).
 */
const SUPPORTED_REQUIRED_EXTENSIONS = new Set([
  'KHR_lights_punctual',
  'KHR_materials_clearcoat',
  'KHR_materials_emissive_strength',
  'KHR_materials_ior',
  'KHR_materials_iridescence',
  'KHR_materials_sheen',
  'KHR_materials_specular',
  'KHR_materials_transmission',
  'KHR_materials_unlit',
  'KHR_materials_volume',
  'KHR_mesh_quantization',
  'KHR_texture_transform',
  'EXT_texture_webp',
  'EXT_mesh_gpu_instancing',
  'KHR_materials_anisotropy',
  'KHR_draco_mesh_compression',
]);

const UNSUPPORTED_USED_EXTENSIONS = new Set(['EXT_meshopt_compression', 'KHR_texture_basisu']);

const COMPONENT_BYTES = new Map<number, number>([
  [5120, 1],
  [5121, 1],
  [5122, 2],
  [5123, 2],
  [5125, 4],
  [5126, 4],
]);

const TYPE_COMPONENTS = new Map<string, number>([
  ['SCALAR', 1],
  ['VEC2', 2],
  ['VEC3', 3],
  ['VEC4', 4],
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function validateDraco(
  json: Record<string, unknown>,
  binaryLength: number,
  fail: () => never,
): boolean {
  let usesDraco = false;
  let decodedByteLength = 0;
  const meshes = json.meshes ?? [];
  if (!Array.isArray(meshes)) return fail();

  for (const mesh of meshes) {
    if (!isRecord(mesh) || !Array.isArray(mesh.primitives)) return fail();
    for (const primitive of mesh.primitives) {
      if (!isRecord(primitive)) return fail();
      const extension = isRecord(primitive.extensions)
        ? primitive.extensions.KHR_draco_mesh_compression
        : undefined;
      if (extension === undefined) continue;
      usesDraco = true;

      if (
        !isRecord(extension) ||
        !isRecord(extension.attributes) ||
        !isRecord(primitive.attributes) ||
        !isNonNegativeInt(extension.bufferView) ||
        !Array.isArray(json.bufferViews) ||
        !Array.isArray(json.accessors) ||
        !Array.isArray(json.buffers) ||
        json.buffers.length !== 1 ||
        !isRecord(json.buffers[0]) ||
        !isNonNegativeInt(json.buffers[0].byteLength) ||
        json.buffers[0].byteLength > binaryLength ||
        binaryLength - json.buffers[0].byteLength > 3 ||
        ![0, 4, undefined].includes(primitive.mode as number | undefined)
      ) {
        return fail();
      }

      const bufferView = json.bufferViews[extension.bufferView] as unknown;
      if (
        !isRecord(bufferView) ||
        bufferView.buffer !== 0 ||
        !isNonNegativeInt(bufferView.byteLength) ||
        bufferView.byteLength === 0 ||
        !isNonNegativeInt(bufferView.byteOffset ?? 0) ||
        Number(bufferView.byteOffset ?? 0) + bufferView.byteLength > json.buffers[0].byteLength ||
        bufferView.byteStride !== undefined
      ) {
        return fail();
      }

      const attributes = Object.entries(extension.attributes);
      if (attributes.length === 0 || !('POSITION' in extension.attributes)) return fail();

      const ids = new Set<number>();
      for (const [semantic, id] of attributes) {
        const accessorIndex = primitive.attributes[semantic];
        if (!isNonNegativeInt(id) || ids.has(id) || !isNonNegativeInt(accessorIndex)) return fail();
        ids.add(id);

        const accessor = json.accessors[accessorIndex] as unknown;
        if (
          !isRecord(accessor) ||
          !isNonNegativeInt(accessor.count) ||
          accessor.count === 0 ||
          accessor.count > 5_000_000 ||
          !COMPONENT_BYTES.has(Number(accessor.componentType)) ||
          !TYPE_COMPONENTS.has(String(accessor.type)) ||
          (semantic === 'POSITION' && (accessor.type !== 'VEC3' || accessor.componentType !== 5126))
        ) {
          return fail();
        }
        const compSize = COMPONENT_BYTES.get(Number(accessor.componentType)) ?? 0;
        const typeCount = TYPE_COMPONENTS.get(String(accessor.type)) ?? 0;
        decodedByteLength += accessor.count * compSize * typeCount;
      }

      if (primitive.indices !== undefined) {
        if (!isNonNegativeInt(primitive.indices)) return fail();
        const indices = json.accessors[primitive.indices] as unknown;
        if (
          !isRecord(indices) ||
          indices.type !== 'SCALAR' ||
          ![5121, 5123, 5125].includes(Number(indices.componentType)) ||
          !isNonNegativeInt(indices.count) ||
          indices.count === 0 ||
          indices.count > 15_000_000
        ) {
          return fail();
        }
        decodedByteLength += indices.count * 4;
      }

      if (decodedByteLength > MAX_GLB_BYTES) return fail();
    }
  }

  return usesDraco;
}

/**
 * Thẩm định nhị phân GLB 2.0 trước khi đưa vào GLTFLoader.
 * Từ chối mọi tệp bị hỏng, chứa URI bên ngoài, nén chưa hỗ trợ hoặc vượt giới hạn bộ nhớ.
 */
export function validateGlb(buffer: ArrayBuffer): { usesDraco: boolean } {
  const fail = (): never => {
    throw new Error('GLB bị hỏng hoặc dùng định dạng chưa hỗ trợ.');
  };
  if (buffer.byteLength < 28 || buffer.byteLength > MAX_GLB_BYTES) return fail();

  const view = new DataView(buffer);
  if (
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== buffer.byteLength ||
    view.getUint32(16, true) !== 0x4e4f534a
  ) {
    return fail();
  }

  const jsonLength = view.getUint32(12, true);
  if (jsonLength % 4 !== 0 || jsonLength > 16 * 1024 * 1024 || jsonLength + 20 > buffer.byteLength) {
    return fail();
  }

  let binaryLength = 0;
  let hasBinary = false;
  for (let offset = jsonLength + 20; offset < buffer.byteLength; ) {
    if (offset + 8 > buffer.byteLength) return fail();
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    if (
      chunkLength % 4 !== 0 ||
      offset + 8 + chunkLength > buffer.byteLength ||
      chunkType === 0x4e4f534a
    ) {
      return fail();
    }
    if (chunkType === 0x004e4942) {
      if (hasBinary) return fail();
      hasBinary = true;
      binaryLength = chunkLength;
    }
    offset += 8 + chunkLength;
  }

  let json: Record<string, unknown>;
  try {
    const decoded = new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength));
    const parsed: unknown = JSON.parse(decoded);
    if (!isRecord(parsed)) return fail();
    json = parsed;
  } catch {
    return fail();
  }

  for (const kind of ['buffers', 'images'] as const) {
    const list = json[kind];
    if (list === undefined) continue;
    if (!Array.isArray(list)) return fail();
    for (const item of list) {
      if (!isRecord(item) || 'uri' in item) return fail();
    }
  }

  for (const kind of ['extensionsUsed', 'extensionsRequired'] as const) {
    const list = json[kind];
    if (list === undefined) continue;
    if (!Array.isArray(list) || list.some((ext: unknown) => typeof ext !== 'string')) {
      return fail();
    }
  }

  const required = (json.extensionsRequired ?? []) as string[];
  const used = (json.extensionsUsed ?? []) as string[];
  if (
    required.some((ext) => !SUPPORTED_REQUIRED_EXTENSIONS.has(ext)) ||
    used.some((ext) => UNSUPPORTED_USED_EXTENSIONS.has(ext))
  ) {
    return fail();
  }

  const usesDraco = validateDraco(json, binaryLength, fail);
  if (usesDraco && !used.includes('KHR_draco_mesh_compression')) return fail();

  return { usesDraco };
}

function validAttribute(attribute: BufferAttribute | InterleavedBufferAttribute): boolean {
  if (
    !Number.isInteger(attribute.count) ||
    attribute.count <= 0 ||
    attribute.itemSize < 1 ||
    attribute.itemSize > 4
  ) {
    return false;
  }
  for (let index = 0; index < attribute.count; index++) {
    for (let axis = 0; axis < attribute.itemSize; axis++) {
      if (!Number.isFinite(attribute.getComponent(index, axis))) return false;
    }
  }
  return true;
}

function validMaterial(material: Material | undefined): boolean {
  if (!material?.isMaterial) return false;
  for (const [key, value] of Object.entries(material) as [string, unknown][]) {
    if (key === 'attenuationDistance' && value === Infinity) continue;
    if (typeof value === 'number' && !Number.isFinite(value)) return false;
    if (value && typeof value === 'object' && 'isColor' in value) {
      const color = value as Color;
      if (![color.r, color.g, color.b].every(Number.isFinite)) return false;
    }
  }
  return true;
}

function validTransform(object: Object3D): boolean {
  return [
    object.position.x,
    object.position.y,
    object.position.z,
    object.quaternion.x,
    object.quaternion.y,
    object.quaternion.z,
    object.quaternion.w,
    object.scale.x,
    object.scale.y,
    object.scale.z,
    ...object.matrix.elements,
  ].every(Number.isFinite);
}

function validSkin(mesh: SkinnedMesh): boolean {
  const joints = mesh.geometry.getAttribute('skinIndex');
  const weights = mesh.geometry.getAttribute('skinWeight');
  const skeleton = mesh.skeleton;
  if (
    !joints ||
    joints.itemSize !== 4 ||
    !weights ||
    weights.itemSize !== 4 ||
    !skeleton?.bones.length ||
    skeleton.boneInverses.length !== skeleton.bones.length ||
    ![...mesh.bindMatrix.elements, ...mesh.bindMatrixInverse.elements].every(Number.isFinite) ||
    skeleton.boneInverses.some((matrix) => !matrix.elements.every(Number.isFinite))
  ) {
    return false;
  }
  for (const bone of skeleton.bones) {
    if (!bone?.isBone || !bone.matrixWorld.elements.every(Number.isFinite)) return false;
    for (let ancestor: Object3D | null = bone; ancestor; ancestor = ancestor.parent) {
      if (!validTransform(ancestor)) return false;
    }
  }
  for (let index = 0; index < joints.count; index++) {
    for (let axis = 0; axis < 4; axis++) {
      const joint = joints.getComponent(index, axis);
      if (!Number.isInteger(joint) || joint < 0 || joint >= skeleton.bones.length) return false;
    }
  }
  return true;
}

function validObject(object: Object3D): boolean {
  if (!validTransform(object)) return false;
  const mesh = object as Mesh;
  if (!mesh.isMesh) return true;

  const instanced = object as InstancedMesh;
  if (instanced.isInstancedMesh) {
    if (
      !Number.isInteger(instanced.count) ||
      instanced.count <= 0 ||
      instanced.count > instanced.instanceMatrix.count ||
      (instanced.instanceColor &&
        (instanced.instanceColor.count < instanced.count ||
          !validAttribute(instanced.instanceColor)))
    ) {
      return false;
    }
    for (const value of instanced.instanceMatrix.array) {
      if (!Number.isFinite(value)) return false;
    }
  }

  const geometry = mesh.geometry;
  const position = geometry?.getAttribute('position');
  if (!position || position.itemSize !== 3 || !validAttribute(position)) return false;

  for (const attribute of Object.values(geometry.attributes)) {
    if (attribute.count !== position.count || !validAttribute(attribute)) return false;
  }
  for (const attributes of Object.values(geometry.morphAttributes)) {
    for (const attribute of attributes ?? []) {
      if (attribute.count !== position.count || !validAttribute(attribute)) return false;
    }
  }
  if ((mesh as SkinnedMesh).isSkinnedMesh && !validSkin(mesh as SkinnedMesh)) return false;

  const indices = geometry.getIndex();
  if (indices) {
    for (let index = 0; index < indices.count; index++) {
      const value = indices.getX(index);
      if (!Number.isInteger(value) || value < 0 || value >= position.count) return false;
    }
  }

  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return (
    materials.length > 0 &&
    materials.every(validMaterial) &&
    geometry.groups.every(
      (group) =>
        Number.isInteger(group.start) &&
        group.start >= 0 &&
        Number.isInteger(group.count) &&
        group.count >= 0 &&
        group.start + group.count <= (indices?.count ?? position.count) &&
        (!Array.isArray(mesh.material) || (group.materialIndex ?? 0) < materials.length),
    )
  );
}

/** Cách ly các subtree/mesh chứa NaN/Infinity hoặc chỉ số sai trước khi đưa lên GPU. */
export function sanitizeModel(scene: Object3D): { quarantined: Object3D[] } {
  const quarantined: Object3D[] = [];
  let usable = 0;
  const visit = (object: Object3D) => {
    if (!validObject(object)) {
      quarantined.push(object);
      return;
    }
    if ((object as Mesh).isMesh) usable += 1;
    for (const child of object.children) visit(child);
  };
  visit(scene);
  if (usable === 0) {
    throw new Error('Mô hình không có mesh hợp lệ.');
  }
  for (const object of quarantined) {
    object.removeFromParent();
  }
  return { quarantined };
}

export interface ModelNormalization {
  scale: number;
  offset: [number, number, number];
  size: [number, number, number];
  center: [number, number, number];
  radius: number;
}

/**
 * Chuẩn hóa tỷ lệ & điểm đặt (tâm XZ = 0, đáy y = 0) vừa khung trưng bày 1.8 x 2.2 x 1.8 m.
 * Không biến đổi dữ liệu gốc để đảm bảo tái dùng geometry/material an toàn.
 */
export function normalizeModel(scene: Object3D, verifiedScale?: number): ModelNormalization {
  scene.updateWorldMatrix(true, true);
  const bounds = new Box3().setFromObject(scene, true);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  if (
    bounds.isEmpty() ||
    ![
      bounds.min.x,
      bounds.min.y,
      bounds.min.z,
      bounds.max.x,
      bounds.max.y,
      bounds.max.z,
    ].every(Number.isFinite) ||
    size.length() <= 1e-9
  ) {
    throw new Error('Mô hình có kích thước không hợp lệ.');
  }

  const scale =
    verifiedScale ?? Math.min(1.8 / (size.x || 1), 2.2 / (size.y || 1), 1.8 / (size.z || 1));
  if (
    !Number.isFinite(scale) ||
    scale < 1e-6 ||
    scale > 1e6 ||
    size.x * scale > 1.80001 ||
    size.y * scale > 2.20001 ||
    size.z * scale > 1.80001
  ) {
    throw new Error('Tỷ lệ mô hình vượt phạm vi trưng bày.');
  }

  size.multiplyScalar(scale);
  return {
    scale,
    offset: [-center.x, -bounds.min.y, -center.z],
    size: [size.x, size.y, size.z],
    center: [0, size.y / 2, 0],
    radius: size.length() / 2,
  };
}

/** Giải phóng duy nhất một lần mọi geometry, material, texture và image bitmap của mô hình. */
export function disposeModel(scenes: readonly Object3D[]): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const images = new Set<unknown>();

  for (const scene of scenes) {
    scene.traverse((object) => {
      const mesh = object as Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material) {
        const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of list) materials.add(material);
      }
      const skeleton = (object as SkinnedMesh).skeleton;
      if (skeleton?.boneTexture) textures.add(skeleton.boneTexture);
    });
  }

  for (const material of materials) {
    for (const value of Object.values(material) as unknown[]) {
      if (value && typeof value === 'object' && 'isTexture' in value) {
        textures.add(value as Texture);
      }
    }
  }

  for (const texture of textures) {
    if (texture.source?.data !== undefined) images.add(texture.source.data);
    texture.dispose();
  }
  for (const image of images) {
    if (
      image &&
      typeof image === 'object' &&
      'close' in image &&
      typeof (image as { close?: unknown }).close === 'function'
    ) {
      (image as { close: () => void }).close();
    }
  }
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}
