import fs from 'node:fs';
import path from 'node:path';
import {
  Box3,
  BoxGeometry,
  BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Texture,
  Vector3,
} from 'three';
import { resolvePublicModelUrl, publicModelSchema } from './glbSchema';
import { disposeModel, normalizeModel, sanitizeModel, validateGlb } from './glbValidation';

function buildGlbBuffer(json: unknown, binary?: Uint8Array): ArrayBuffer {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const jsonSize = Math.ceil(text.length / 4) * 4;
  const binSize = binary ? Math.ceil(binary.byteLength / 4) * 4 : 0;
  const result = new ArrayBuffer(20 + jsonSize + (binary ? 8 + binSize : 0));
  const view = new DataView(result);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, result.byteLength, true);
  view.setUint32(12, jsonSize, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(result, 20, jsonSize).fill(0x20);
  new Uint8Array(result, 20, text.length).set(text);
  if (binary) {
    view.setUint32(20 + jsonSize, binSize, true);
    view.setUint32(24 + jsonSize, 0x004e4942, true);
    new Uint8Array(result, 28 + jsonSize, binary.byteLength).set(binary);
  }
  return result;
}

describe('glbSchema & resolvePublicModelUrl (MOB-E6-02)', () => {
  const sha = 'a'.repeat(64);
  const validModel = {
    id: '10000000-0000-4000-8000-000000000001',
    storageKey: 'models/bronze-drum.glb',
    sizeBytes: 1024,
    checksumSha256: sha,
    url: `/rooms/dong-son/exhibits/10000000-0000-4000-8000-000000000001/model?version=${sha}`,
  };

  it('chấp nhận payload PublicModel chuẩn API và từ chối path traversal / URL giả mạo', () => {
    expect(publicModelSchema.safeParse(validModel).success).toBe(true);
    expect(
      publicModelSchema.safeParse({ ...validModel, storageKey: '../secret.glb' }).success,
    ).toBe(false);
    expect(
      publicModelSchema.safeParse({ ...validModel, url: 'https://evil.example/model.glb' }).success,
    ).toBe(false);
    expect(
      resolvePublicModelUrl('https://api.aura-museum.example/api/', validModel.url),
    ).toBe(`https://api.aura-museum.example/api${validModel.url}`);
    expect(() => resolvePublicModelUrl('https://api.aura.example/api', '//evil.com/a')).toThrow();
    expect(() => resolvePublicModelUrl('javascript:alert(1)', validModel.url)).toThrow();
  });
});

describe('validateGlb trên tệp thật từ back-end/public/media/uploads/models và payload tấn công', () => {
  it('xác thực thành công toàn bộ tệp GLB thật đang lưu trong back-end', () => {
    const modelsDir = path.resolve(__dirname, '../../../../back-end/public/media/uploads/models');
    const glbFiles = fs.readdirSync(modelsDir).filter((file) => file.endsWith('.glb'));
    expect(glbFiles.length).toBeGreaterThan(0);

    for (const file of glbFiles) {
      const nodeBuf = fs.readFileSync(path.join(modelsDir, file));
      const arrayBuf = nodeBuf.buffer.slice(
        nodeBuf.byteOffset,
        nodeBuf.byteOffset + nodeBuf.byteLength,
      );
      expect(validateGlb(arrayBuf)).toEqual({ usesDraco: false });
    }
  });

  it('từ chối GLB chứa URI ngoài, nén chưa hỗ trợ hoặc header bị hỏng', () => {
    expect(
      validateGlb(
        buildGlbBuffer({
          asset: { version: '2.0' },
          buffers: [{ byteLength: 4 }],
          images: [{ bufferView: 0 }],
        }),
      ),
    ).toEqual({ usesDraco: false });

    const malicious = [
      { buffers: [{ uri: 'https://attacker.example/payload.bin' }] },
      { images: [{ uri: 'file:///etc/passwd' }] },
      { extensionsRequired: ['KHR_unknown_ext'] },
      { extensionsUsed: ['EXT_meshopt_compression'] },
      { extensionsUsed: ['KHR_texture_basisu'] },
    ];
    for (const json of malicious) {
      expect(() => validateGlb(buildGlbBuffer(json))).toThrow();
    }
    expect(() => validateGlb(new ArrayBuffer(12))).toThrow();
  });
});

describe('sanitizeModel, normalizeModel và disposeModel', () => {
  it('cách ly mesh chứa NaN/Infinity nhưng giữ nguyên các mesh hợp lệ và giải phóng GPU đúng 1 lần', () => {
    const scene = new Group();
    const healthy = new Mesh(new BoxGeometry(2, 4, 1), new MeshStandardMaterial());
    const badPos = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    const posAttr = badPos.geometry.getAttribute('position');
    posAttr.setX(0, Number.NaN);
    const badMat = new Mesh(new BoxGeometry(), new MeshPhysicalMaterial());
    badMat.material.opacity = Number.POSITIVE_INFINITY;
    const badInstanced = new InstancedMesh(new BoxGeometry(), new MeshStandardMaterial(), 1);
    badInstanced.setMatrixAt(0, new Matrix4().makeTranslation(Number.NaN, 0, 0));

    scene.add(healthy, badPos, badMat, badInstanced);
    const { quarantined } = sanitizeModel(scene);
    expect(quarantined).toEqual([badPos, badMat, badInstanced]);
    expect(scene.children).toEqual([healthy]);

    const norm = normalizeModel(scene);
    const pivot = new Group();
    pivot.scale.setScalar(norm.scale);
    const offset = new Group();
    offset.position.fromArray(norm.offset);
    offset.add(scene);
    pivot.add(offset);
    pivot.updateMatrixWorld(true);

    const bounds = new Box3().setFromObject(pivot, true);
    expect(bounds.min.y).toBeCloseTo(0);
    expect(bounds.getCenter(new Vector3()).x).toBeCloseTo(0);
    expect(bounds.getSize(new Vector3()).y).toBeLessThanOrEqual(2.2001);

    const closeSpy = jest.fn();
    const tex = new Texture();
    tex.source.data = { close: closeSpy };
    (healthy.material as MeshStandardMaterial).map = tex;
    const geoSpy = jest.spyOn(healthy.geometry, 'dispose');
    const matSpy = jest.spyOn(healthy.material as MeshStandardMaterial, 'dispose');
    const texSpy = jest.spyOn(tex, 'dispose');

    disposeModel([scene, ...quarantined]);
    expect(geoSpy).toHaveBeenCalledTimes(1);
    expect(matSpy).toHaveBeenCalledTimes(1);
    expect(texSpy).toHaveBeenCalledTimes(1);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('từ chối scene không có mesh hợp lệ và từ chối model rỗng / tỷ lệ quá khổ', () => {
    const empty = new Group();
    expect(() => sanitizeModel(empty)).toThrow('Mô hình không có mesh hợp lệ');
    expect(() => normalizeModel(empty)).toThrow('Mô hình có kích thước không hợp lệ');

    const badAttr = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    badAttr.geometry.setAttribute('normal', new BufferAttribute(new Float32Array([Number.NaN, 0, 0]), 3));
    const wrap = new Group();
    wrap.add(badAttr);
    expect(() => sanitizeModel(wrap)).toThrow();
  });
});
