import type { BufferAttribute, Color, InstancedMesh, InterleavedBufferAttribute, Material, Mesh, Object3D, SkinnedMesh } from 'three';

function validAttribute(attribute: BufferAttribute | InterleavedBufferAttribute) {
  if (!Number.isInteger(attribute.count) || attribute.count <= 0 || attribute.itemSize < 1 || attribute.itemSize > 4) return false;
  for (let index = 0; index < attribute.count; index++) for (let axis = 0; axis < attribute.itemSize; axis++) {
    if (!Number.isFinite(attribute.getComponent(index, axis))) return false;
  }
  return true;
}

function validMaterial(material: Material) {
  if (!material?.isMaterial) return false;
  for (const [key, value] of Object.entries(material) as [string, unknown][]) {
    // Three uses +Infinity to mean no volume attenuation, including KHR_materials_specular.
    if (key === 'attenuationDistance' && value === Infinity) continue;
    if (typeof value === 'number' && !Number.isFinite(value)) return false;
    if (value && typeof value === 'object' && 'isColor' in value) {
      const color = value as Color;
      if (![color.r, color.g, color.b].every(Number.isFinite)) return false;
    }
  }
  return true;
}

function validTransform(object: Object3D) {
  return [...object.position, ...object.quaternion, ...object.scale, ...object.matrix.elements].every(Number.isFinite);
}

function validSkin(mesh: SkinnedMesh) {
  const joints = mesh.geometry.getAttribute('skinIndex'); const weights = mesh.geometry.getAttribute('skinWeight');
  const skeleton = mesh.skeleton;
  if (!joints || joints.itemSize !== 4 || !weights || weights.itemSize !== 4 || !skeleton?.bones.length
    || skeleton.boneInverses.length !== skeleton.bones.length
    || ![...mesh.bindMatrix.elements, ...mesh.bindMatrixInverse.elements].every(Number.isFinite)
    || skeleton.boneInverses.some(matrix => !matrix.elements.every(Number.isFinite))) return false;
  for (const bone of skeleton.bones) {
    if (!bone?.isBone || !bone.matrixWorld.elements.every(Number.isFinite)) return false;
    // A bone can live outside this mesh's subtree; its ancestors still affect bounds.
    for (let ancestor: Object3D | null = bone; ancestor; ancestor = ancestor.parent) if (!validTransform(ancestor)) return false;
  }
  for (let index = 0; index < joints.count; index++) for (let axis = 0; axis < 4; axis++) {
    const joint = joints.getComponent(index, axis);
    if (!Number.isInteger(joint) || joint < 0 || joint >= skeleton.bones.length) return false;
  }
  return true;
}

function validObject(object: Object3D) {
  if (!validTransform(object)) return false;
  const mesh = object as Mesh;
  if (!mesh.isMesh) return true;
  const instanced = object as InstancedMesh;
  if (instanced.isInstancedMesh) {
    if (!Number.isInteger(instanced.count) || instanced.count <= 0 || instanced.count > instanced.instanceMatrix.count
      || (instanced.instanceColor && (instanced.instanceColor.count < instanced.count || !validAttribute(instanced.instanceColor)))) return false;
    for (const value of instanced.instanceMatrix.array) if (!Number.isFinite(value)) return false;
  }
  const geometry = mesh.geometry;
  const position = geometry?.getAttribute('position');
  if (!position || position.itemSize !== 3 || !validAttribute(position)) return false;
  for (const attribute of Object.values(geometry.attributes)) if (attribute.count !== position.count || !validAttribute(attribute)) return false;
  for (const attributes of Object.values(geometry.morphAttributes)) for (const attribute of attributes ?? []) {
    if (attribute.count !== position.count || !validAttribute(attribute)) return false;
  }
  if ((mesh as SkinnedMesh).isSkinnedMesh && !validSkin(mesh as SkinnedMesh)) return false;
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
