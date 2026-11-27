import {
  BufferGeometry,
  Camera,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import type { ProbeMaskedHit } from './galleryPicking';

/** R3F Native wraps render() to present the frame. Keep the offscreen pass off that path. */
export class GalleryRenderer extends WebGLRenderer {
  readonly renderOffscreen = this.render.bind(this);
}

/** Apply Three's alpha test to just the intersected triangle at the touched pixel. */
export function createGalleryAlphaProbe(
  renderer: WebGLRenderer,
  renderOffscreen: WebGLRenderer['render'],
  camera: Camera,
) {
  const target = new WebGLRenderTarget(1, 1, { depthBuffer: false });
  const pixel = new Uint8Array(4);
  const size = new Vector2();
  const clearColor = new Color();
  const probeCamera = new Camera();
  probeCamera.matrixWorldAutoUpdate = false;
  const crop = new Matrix4();
  const worldMatrix = new Matrix4();
  const instanceMatrix = new Matrix4();
  const vertex = new Vector3();

  const geometry = new BufferGeometry();
  const positions = new Float32BufferAttribute(new Float32Array(9), 3);
  const colors = new Float32BufferAttribute(new Float32Array(12).fill(1), 4);
  geometry.setAttribute('position', positions);
  geometry.setAttribute('color', colors);
  const uvs = ['uv', 'uv1', 'uv2', 'uv3'].map((name) => {
    const attribute = new Float32BufferAttribute(new Float32Array(6), 2);
    geometry.setAttribute(name, attribute);
    return { name, attribute };
  });
  const material = new MeshBasicMaterial({ side: DoubleSide, toneMapped: false });
  const triangle = new Mesh(geometry, material);
  triangle.frustumCulled = false;
  const scene = new Scene();
  scene.add(triangle);

  const test: ProbeMaskedHit = ({ object, face, instanceId }, source, pointer) => {
    if (!face) return true;
    renderer.getDrawingBufferSize(size);
    if (!size.x || !size.y) return true;

    worldMatrix.copy(object.matrixWorld);
    if (object instanceof InstancedMesh && instanceId !== undefined) {
      object.getMatrixAt(instanceId, instanceMatrix);
      worldMatrix.multiply(instanceMatrix);
    }
    const indices = [face.a, face.b, face.c];
    indices.forEach((index, i) => {
      object.getVertexPosition(index, vertex).applyMatrix4(worldMatrix);
      positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
    });
    positions.needsUpdate = true;

    for (const { name, attribute } of uvs) {
      const sourceUv = object.geometry.getAttribute(name);
      indices.forEach((index, i) => {
        attribute.setXY(i, sourceUv?.getX(index) ?? 0, sourceUv?.getY(index) ?? 0);
      });
      attribute.needsUpdate = true;
    }
    const sourceColor = object.geometry.getAttribute('color');
    const vertexAlpha =
      source.vertexColors && sourceColor?.itemSize === 4 ? sourceColor : undefined;
    material.vertexColors = vertexAlpha !== undefined;
    if (vertexAlpha) {
      indices.forEach((index, i) => colors.setW(i, vertexAlpha.getW(index)));
      colors.needsUpdate = true;
    }
    // Keep the original GPU textures, including their transforms, UV channel and sampler.
    const maps = source as Partial<Pick<MeshBasicMaterial, 'map' | 'alphaMap'>>;
    material.map = maps.map ?? null;
    material.alphaMap = maps.alphaMap ?? null;
    material.opacity = source.opacity;
    material.alphaTest = source.alphaTest;
    material.needsUpdate = true;

    // A one-pixel viewport crop preserves the source triangle's texture gradients.
    crop.makeScale(size.x, size.y, 1);
    crop.setPosition(-pointer.x * size.x, -pointer.y * size.y, 0);
    probeCamera.projectionMatrix.multiplyMatrices(crop, camera.projectionMatrix);
    probeCamera.matrixWorld.copy(camera.matrixWorld);
    probeCamera.matrixWorldInverse.copy(camera.matrixWorldInverse);

    const previousTarget = renderer.getRenderTarget();
    const previousFace = renderer.getActiveCubeFace();
    const previousLevel = renderer.getActiveMipmapLevel();
    renderer.getClearColor(clearColor);
    const previousClearAlpha = renderer.getClearAlpha();
    try {
      renderer.setRenderTarget(target);
      renderer.setClearColor(0, 0);
      renderer.clear(true, false, false);
      renderOffscreen(scene, probeCamera);
      pixel[3] = 255;
      renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
      return pixel[3] !== 0;
    } catch {
      // Keep the foreground hit if a driver cannot complete the readback.
      return true;
    } finally {
      renderer.setClearColor(clearColor, previousClearAlpha);
      renderer.setRenderTarget(previousTarget, previousFace, previousLevel);
    }
  };

  const dispose = () => {
    target.dispose();
    geometry.dispose();
    material.dispose();
  };
  return { test, dispose };
}
