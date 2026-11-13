import { getBounds } from '@gltf-transform/core';
import { AssetError } from './validation.mjs';

const subtract = (a, b) => a.map((value, axis) => value - b[axis]);
const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const distanceSquared = (a, b) => dot(subtract(a, b), subtract(a, b));

export function primitiveGeometry(primitive) {
  const position = primitive.getAttribute('POSITION');
  const vertices = Array.from({ length: position.getCount() }, (_, index) => position.getElement(index, []));
  if (vertices.some((point) => point.some((value) => !Number.isFinite(value)))) throw new AssetError('INVALID_INPUT', 'Non-finite geometry');
  const accessor = primitive.getIndices();
  const indices = accessor ? Array.from(accessor.getArray()) : vertices.map((_, index) => index);
  if (indices.some((index) => !Number.isInteger(index) || !vertices[index])) throw new AssetError('INVALID_INPUT', 'Index outside vertex range');
  const triangles = [];
  for (let index = 0; index < indices.length; index += 3) triangles.push(indices.slice(index, index + 3).map((vertex) => vertices[vertex]));
  return { vertices, triangles };
}

export function primitiveList(document) {
  return document.getRoot().listMeshes().flatMap((mesh) => mesh.listPrimitives());
}

function textureInfo(material, slot, textures) {
  const texture = material[`get${slot}Texture`]();
  const info = material[`get${slot}TextureInfo`]();
  if (!texture) return null;
  return { texture: textures.indexOf(texture), texCoord: info.getTexCoord(), magFilter: info.getMagFilter(), minFilter: info.getMinFilter(), wrapS: info.getWrapS(), wrapT: info.getWrapT() };
}

export function sceneIdentity(document) {
  const root = document.getRoot();
  const nodes = root.listNodes();
  const meshes = root.listMeshes();
  const materials = root.listMaterials();
  const textures = root.listTextures();
  return {
    nodes: nodes.map((node) => ({ name: node.getName(), extras: node.getExtras(), matrix: node.getMatrix(), children: node.listChildren().map((child) => nodes.indexOf(child)), mesh: meshes.indexOf(node.getMesh()) })),
    scenes: root.listScenes().map((scene) => ({ name: scene.getName(), children: scene.listChildren().map((child) => nodes.indexOf(child)) })),
    defaultScene: root.listScenes().indexOf(root.getDefaultScene()),
    meshes: meshes.map((mesh) => ({ name: mesh.getName(), primitives: mesh.listPrimitives().map((primitive) => ({ material: materials.indexOf(primitive.getMaterial()), semantics: primitive.listSemantics().sort(), mode: primitive.getMode() })) })),
    materials: materials.map((material) => ({ name: material.getName(), extras: material.getExtras(), baseColor: material.getBaseColorFactor(), emissive: material.getEmissiveFactor(), roughness: material.getRoughnessFactor(), metallic: material.getMetallicFactor(), normalScale: material.getNormalScale(), occlusionStrength: material.getOcclusionStrength(), alphaMode: material.getAlphaMode(), alphaCutoff: material.getAlphaCutoff(), doubleSided: material.getDoubleSided(), textures: ['BaseColor', 'Emissive', 'Normal', 'Occlusion', 'MetallicRoughness'].map((slot) => textureInfo(material, slot, textures)) })),
  };
}

export function geometryMetrics(document) {
  const root = document.getRoot();
  const primitives = primitiveList(document);
  const bounds = root.listScenes().map((scene) => getBounds(scene));
  if (bounds.some((bound) => [...bound.min, ...bound.max].some((value) => !Number.isFinite(value)))) throw new AssetError('INVALID_INPUT', 'Empty or non-finite scene bounds');
  return {
    nodes: root.listNodes().length,
    meshes: root.listMeshes().length,
    materials: root.listMaterials().length,
    primitives: primitives.length,
    vertices: primitives.reduce((total, primitive) => total + primitive.getAttribute('POSITION').getCount(), 0),
    triangles: primitives.reduce((total, primitive) => total + (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION').getCount()) / 3, 0),
    bounds,
    transforms: root.listNodes().map((node) => ({ name: node.getName(), matrix: node.getMatrix() })),
    textures: root.listTextures().map((texture) => ({ name: texture.getName(), mimeType: texture.getMimeType(), bytes: texture.getImage()?.byteLength ?? 0, size: texture.getSize() })),
  };
}

/** Conservative topology check merges positions only for classification, without changing vertex seams. */
export function lodUnsupported(document) {
  if (document.getRoot().listMaterials().some((material) => material.getAlphaMode() !== 'OPAQUE' || material.getDoubleSided())) return 'Transparent or double-sided material';
  for (const primitive of primitiveList(document)) {
    const { triangles } = primitiveGeometry(primitive);
    const edges = new Map();
    for (const triangle of triangles) {
      const keys = triangle.map((point) => point.map((value) => Math.round(value * 1e7)).join(','));
      if (new Set(keys).size < 3) continue;
      for (let index = 0; index < 3; index++) {
        const edge = [keys[index], keys[(index + 1) % 3]].sort().join('|');
        edges.set(edge, (edges.get(edge) ?? 0) + 1);
      }
    }
    if (!edges.size || [...edges.values()].some((count) => count !== 2)) return 'Open or non-manifold surface';
  }
  return null;
}

function pointTriangleDistanceSquared(point, [a, b, c]) {
  const ab = subtract(b, a);
  const ac = subtract(c, a);
  const ap = subtract(point, a);
  const d1 = dot(ab, ap);
  const d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return distanceSquared(point, a);
  const bp = subtract(point, b);
  const d3 = dot(ab, bp);
  const d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return distanceSquared(point, b);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const fraction = d1 / (d1 - d3);
    return distanceSquared(point, a.map((value, axis) => value + fraction * ab[axis]));
  }
  const cp = subtract(point, c);
  const d5 = dot(ab, cp);
  const d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return distanceSquared(point, c);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const fraction = d2 / (d2 - d6);
    return distanceSquared(point, a.map((value, axis) => value + fraction * ac[axis]));
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const fraction = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    return distanceSquared(point, b.map((value, axis) => value + fraction * (c[axis] - value)));
  }
  const denominator = va + vb + vc;
  if (denominator === 0) return Math.min(distanceSquared(point, a), distanceSquared(point, b), distanceSquared(point, c));
  const v = vb / denominator;
  const w = vc / denominator;
  return distanceSquared(point, a.map((value, axis) => value + ab[axis] * v + ac[axis] * w));
}

function treeBounds(triangles) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const triangle of triangles) for (const point of triangle) for (let axis = 0; axis < 3; axis++) {
    min[axis] = Math.min(min[axis], point[axis]);
    max[axis] = Math.max(max[axis], point[axis]);
  }
  return { min, max };
}

function buildTree(triangles) {
  const bounds = treeBounds(triangles);
  if (triangles.length <= 16) return { ...bounds, triangles };
  const widths = subtract(bounds.max, bounds.min);
  const axis = widths.indexOf(Math.max(...widths));
  triangles.sort((a, b) => a.reduce((sum, point) => sum + point[axis], 0) - b.reduce((sum, point) => sum + point[axis], 0));
  const middle = Math.floor(triangles.length / 2);
  return { ...bounds, children: [buildTree(triangles.slice(0, middle)), buildTree(triangles.slice(middle))] };
}

function boxDistance(point, tree) {
  return point.reduce((sum, value, axis) => sum + Math.max(tree.min[axis] - value, 0, value - tree.max[axis]) ** 2, 0);
}

function nearestSurface(point, tree, best = Infinity) {
  if (boxDistance(point, tree) > best) return best;
  if (tree.triangles) {
    for (const triangle of tree.triangles) best = Math.min(best, pointTriangleDistanceSquared(point, triangle));
    return best;
  }
  const children = [...tree.children].sort((a, b) => boxDistance(point, a) - boxDistance(point, b));
  for (const child of children) best = nearestSurface(point, child, best);
  return best;
}

function sampleSurface(geometry, limit = 256) {
  const points = [];
  const vertexStep = Math.max(1, Math.ceil(geometry.vertices.length / limit));
  const triangleStep = Math.max(1, Math.ceil(geometry.triangles.length / limit));
  for (let index = 0; index < geometry.vertices.length; index += vertexStep) points.push(geometry.vertices[index]);
  for (let index = 0; index < geometry.triangles.length; index += triangleStep) {
    const triangle = geometry.triangles[index];
    points.push([0, 1, 2].map((axis) => triangle.reduce((sum, point) => sum + point[axis], 0) / 3));
  }
  return points;
}

function compareAttributes(sourcePrimitive, targetPrimitive, scale, bidirectional) {
  const result = { maxNormalAngleDegrees: 0, maxUvError: 0, maxColorError: 0, maxTangentError: 0 };
  const epsilon = Math.max(scale * 0.000005, Number.EPSILON);
  const directions = [[targetPrimitive, sourcePrimitive]];
  if (bidirectional) directions.push([sourcePrimitive, targetPrimitive]);
  for (const [from, to] of directions) {
    const positions = to.getAttribute('POSITION');
    const grid = new Map();
    const targetIndices = to.getIndices() ? new Set(to.getIndices().getArray()) : new Set(Array.from({ length: positions.getCount() }, (_, index) => index));
    for (const index of targetIndices) {
      const key = positions.getElement(index, []).map((value) => Math.floor(value / epsilon)).join(',');
      const bucket = grid.get(key) ?? [];
      bucket.push(index);
      grid.set(key, bucket);
    }
    const origin = from.getAttribute('POSITION');
    const sourceIndices = from.getIndices() ? new Set(from.getIndices().getArray()) : new Set(Array.from({ length: origin.getCount() }, (_, index) => index));
    for (const index of sourceIndices) {
      const position = origin.getElement(index, []);
      const cell = position.map((value) => Math.floor(value / epsilon));
      const candidates = [];
      for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
        for (const other of grid.get([cell[0] + x, cell[1] + y, cell[2] + z].join(',')) ?? []) {
          if (distanceSquared(position, positions.getElement(other, [])) <= epsilon ** 2) candidates.push(other);
        }
      }
      let best;
      for (const other of candidates) {
        const errors = { maxNormalAngleDegrees: 0, maxUvError: 0, maxColorError: 0, maxTangentError: 0 };
        for (const semantic of from.listSemantics()) {
          if (semantic === 'POSITION') continue;
          const a = from.getAttribute(semantic).getElement(index, []);
          const b = to.getAttribute(semantic).getElement(other, []);
          const maximum = Math.max(...a.map((value, axis) => Math.abs(value - b[axis])));
          if (semantic === 'NORMAL') {
            const norm = Math.sqrt(dot(a, a) * dot(b, b));
            errors.maxNormalAngleDegrees = norm > 0 ? Math.acos(Math.max(-1, Math.min(1, dot(a, b) / norm))) * 180 / Math.PI : 180;
          } else if (semantic.startsWith('TEXCOORD')) errors.maxUvError = Math.max(errors.maxUvError, maximum);
          else if (semantic.startsWith('COLOR')) errors.maxColorError = maximum;
          else if (semantic === 'TANGENT') errors.maxTangentError = maximum;
        }
        const score = Math.max(errors.maxNormalAngleDegrees / 0.05, errors.maxUvError / 0.00005, errors.maxColorError / 0.00005, errors.maxTangentError / 0.0001);
        if (!best || score < best.score) best = { score, errors };
      }
      if (!best || best.score > 1) throw new AssetError('QUALITY_REJECTED', `Retained vertex attributes, normals or UV changed beyond conservative tolerances at vertex ${index} (${JSON.stringify(best?.errors ?? { positionMismatch: true })})`);
      for (const key of Object.keys(result)) result[key] = Math.max(result[key], best.errors[key]);
    }
  }
  return result;
}

export function compareGeometry(original, candidate, lod, config) {
  if (JSON.stringify(sceneIdentity(original)) !== JSON.stringify(sceneIdentity(candidate))) throw new AssetError('QUALITY_REJECTED', 'Scene hierarchy, transforms, attributes or materials changed');
  const sourceMetrics = geometryMetrics(original);
  const metrics = geometryMetrics(candidate);
  let relativeBoundsDelta = 0;
  for (let index = 0; index < metrics.bounds.length; index++) {
    const before = sourceMetrics.bounds[index];
    const after = metrics.bounds[index];
    const diagonal = Math.sqrt(distanceSquared(before.min, before.max));
    if (!(diagonal > 0)) throw new AssetError('INVALID_INPUT', 'Zero-size geometry');
    const delta = Math.max(...before.min.map((value, axis) => Math.abs(value - after.min[axis])), ...before.max.map((value, axis) => Math.abs(value - after.max[axis])));
    relativeBoundsDelta = Math.max(relativeBoundsDelta, delta / diagonal);
  }
  let relativeSurfaceError = 0;
  const attributeErrors = { maxNormalAngleDegrees: 0, maxUvError: 0, maxColorError: 0, maxTangentError: 0 };
  const sources = primitiveList(original);
  const outputs = primitiveList(candidate);
  for (let index = 0; index < sources.length; index++) {
    const source = primitiveGeometry(sources[index]);
    const output = primitiveGeometry(outputs[index]);
    if (!output.triangles.length) throw new AssetError('QUALITY_REJECTED', 'Primitive disappeared');
    const bounds = treeBounds(source.triangles);
    const scale = Math.sqrt(distanceSquared(bounds.min, bounds.max));
    const primitiveAttributeErrors = compareAttributes(sources[index], outputs[index], scale, lod === 0);
    for (const key of Object.keys(attributeErrors)) attributeErrors[key] = Math.max(attributeErrors[key], primitiveAttributeErrors[key]);
    for (const [from, to] of [[source, output], [output, source]]) {
      const tree = buildTree([...to.triangles]);
      for (const point of sampleSurface(from)) relativeSurfaceError = Math.max(relativeSurfaceError, Math.sqrt(nearestSurface(point, tree)) / scale);
    }
  }
  const boundsTolerance = lod === 0 ? 0.00001 : config.boundsTolerance;
  const surfaceTolerance = lod === 0 ? 0.00001 : config.surfaceTolerance;
  if (relativeBoundsDelta > boundsTolerance || relativeSurfaceError > surfaceTolerance) throw new AssetError('QUALITY_REJECTED', 'Geometry bounds or sampled surface error exceeds tolerance');
  if (lod === 0 && metrics.triangles !== sourceMetrics.triangles) throw new AssetError('QUALITY_REJECTED', 'LOD0 triangle count changed');
  return { visual: 'REVIEW_REQUIRED', relativeBoundsDelta, relativeSurfaceError, ...attributeErrors, attributePolicy: 'All retained vertices checked against source position and matching normals, UV, color and tangent. LOD0 checked both directions.', surfaceMethod: 'bidirectional deterministic vertex and triangle-centroid samples to full triangle surface, up to 512 samples per primitive per direction', boundsTolerance, surfaceTolerance, sceneIdentityPreserved: true };
}
