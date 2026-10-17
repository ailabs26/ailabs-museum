import type { BufferAttribute, Color, InterleavedBufferAttribute, Material, Mesh, Object3D } from 'three';

function validAttribute(attribute: BufferAttribute | InterleavedBufferAttribute) {
  if (!Number.isInteger(attribute.count) || attribute.count <= 0 || attribute.itemSize < 1 || attribute.itemSize > 4) return false;
  for (let index = 0; index < attribute.count; index++) for (let axis = 0; axis < attribute.itemSize; axis++) {
    if (!Number.isFinite(attribute.getComponent(index, axis))) return false;
  }
  return true;
}

function validMaterial(material: Material) {
  if (!material?.isMaterial) return false;
  for (const value of Object.values(material) as unknown[]) {
    if (typeof value === 'number' && !Number.isFinite(value)) return false;
    if (value && typeof value === 'object' && 'isColor' in value) {
      const color = value as Color;
      if (![color.r, color.g, color.b].every(Number.isFinite)) return false;
    }
  }
  return true;
}

function validObject(object: Object3D) {
  if (![...object.position, ...object.quaternion, ...object.scale, ...object.matrix.elements].every(Number.isFinite)) return false;
  const mesh = object as Mesh;
  if (!mesh.isMesh) return true;
  const geometry = mesh.geometry;
  const position = geometry?.getAttribute('position');
  if (!position || position.itemSize !== 3 || !validAttribute(position)) return false;
  for (const attribute of Object.values(geometry.attributes)) if (attribute.count !== position.count || !validAttribute(attribute)) return false;
  for (const attributes of Object.values(geometry.morphAttributes)) for (const attribute of attributes ?? []) {
    if (attribute.count !== position.count || !validAttribute(attribute)) return false;
  }
  const indices = geometry.getIndex();
  if (indices) for (let index = 0; index < indices.count; index++) {
    const value = indices.getX(index);
    if (!Number.isInteger(value) || value < 0 || value >= position.count) return false;
  }
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.length > 0 && materials.every(validMaterial)
    && geometry.groups.every(group => Number.isInteger(group.start) && group.start >= 0 && Number.isInteger(group.count) && group.count >= 0
      && group.start + group.count <= (indices?.count ?? position.count)
      && (!Array.isArray(mesh.material) || (group.materialIndex ?? 0) < materials.length));
}

/** Parsed scenes only. Never claim to recover meshes from an unsuccessful GLB parse. */
export function sanitizeModel(scene: Object3D): { quarantined: Object3D[] } {
  const quarantined: Object3D[] = [];
  let usable = 0;
  const visit = (object: Object3D) => {
    if (!validObject(object)) { quarantined.push(object); return; }
    if ((object as Mesh).isMesh) usable++;
    for (const child of object.children) visit(child);
  };
  visit(scene);
  // Leave the original ownership tree intact on total failure for the loader's cleanup.
  if (!usable) throw new Error('Mô hình không có mesh hợp lệ.');
  for (const object of quarantined) object.removeFromParent();
  return { quarantined };
}
