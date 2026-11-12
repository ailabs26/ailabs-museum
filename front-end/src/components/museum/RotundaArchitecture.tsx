import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { AdditiveBlending, CanvasTexture, Euler, Matrix4, MeshBasicMaterial, Shape, ShapeGeometry, SRGBColorSpace, type InstancedMesh, type Material, type Vector3Tuple } from 'three';
import { GALLERY_SLOTS } from '@/helpers/gallerySlots';
import { drawFrieze, drawHalo, drawRotundaSign, drawSkylight, drawWash } from '@/helpers/rotundaTextures';
import { useGallerySurfaces } from './GallerySurfaces';

interface Placement { position: Vector3Tuple; rotationY?: number }
const HALF_PI = Math.PI / 2;
const HERO = GALLERY_SLOTS[0].position;
/** Tâm vòng trần và hoạ tiết sàn trùng bục trung tâm. */
const [CX, , CZ] = HERO;
// Hốc vòm hai bên nằm ngay sau bốn bục cạnh; cửa vòm ở tường lối vào.
const BAYS: Placement[] = GALLERY_SLOTS.filter(slot => slot.plinthKind === 'standard')
  .map(({ position: [x, , z] }) => ({ position: [Math.sign(x) * 6.985, .42, z], rotationY: -Math.sign(x) * HALF_PI }));
const ENTRANCE: Placement = { position: [0, 0, 7.985], rotationY: Math.PI };
const inward = (placements: readonly Placement[], depth: number): Placement[] => placements.map(({ position: [x, y, z], rotationY = 0 }) =>
  ({ position: [x + Math.sin(rotationY) * depth, y, z + Math.cos(rotationY) * depth], rotationY }));
const SLATS: Placement[] = Array.from({ length: 64 }, (_, index) => {
  const angle = index * Math.PI / 32;
  return { position: [CX + Math.sin(angle) * 4.3, 4.9, CZ + Math.cos(angle) * 4.3], rotationY: angle };
});
const WALL_SLATS: Placement[] = [-1, 1].flatMap(side => Array.from({ length: 16 }, (_, index): Placement => ({ position: [side * 6.93, 2.45, 4.25 + index * .2] })));
const PILASTERS: Placement[] = [-1, 1].map(side => ({ position: [side * 3.5, 2.5, -7.93] }));
const PILASTER_TRIMS: Placement[] = [-1, 1].flatMap(side => [-1, 1].map((edge): Placement => ({ position: [side * 3.5 + edge * .72, 2.5, -7.84] })));
const SIDE_SKIRTING: Placement[] = [-1, 1].map(side => ({ position: [side * 6.94, .15, 0] }));
const END_SKIRTING: Placement[] = [-1, 1].map(side => ({ position: [0, .15, side * 7.94] }));
const SIDE_COVES: Placement[] = [-1, 1].flatMap(side => [.33, 4.52].map((y): Placement => ({ position: [side * 6.93, y, 0] })));
const END_COVES: Placement[] = [-1, 1].flatMap(side => [.33, 4.52].map((y): Placement => ({ position: [0, y, side * 7.93] })));
const SIDE_CORNICE: Placement[] = [-1, 1].map(side => ({ position: [side * 6.86, 4.66, 0] }));
const END_CORNICE: Placement[] = [-1, 1].map(side => ({ position: [0, 4.66, side * 7.86] }));

function Instances({ placements, material, children }: { placements: readonly Placement[]; material: Material; children: ReactNode }) {
  const meshRef = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new Matrix4(), euler = new Euler();
    placements.forEach(({ position, rotationY = 0 }, index) =>
      mesh.setMatrixAt(index, matrix.makeRotationFromEuler(euler.set(0, rotationY, 0)).setPosition(...position)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [placements]);
  return <instancedMesh ref={meshRef} args={[undefined, undefined, placements.length]} material={material} receiveShadow>{children}</instancedMesh>;
}

/** Vòm: thân chữ nhật + nửa hình tròn. `border` > 0 trả về riêng phần khung. UV chuẩn hoá 0–1 cho dải sáng. */
function archGeometry(width: number, height: number, border = 0): ShapeGeometry {
  const radius = width / 2, spring = height - radius, shape = new Shape();
  shape.moveTo(-radius, 0);
  if (border) {
    const inner = radius - border;
    shape.lineTo(-radius, spring); shape.absarc(0, spring, radius, Math.PI, 0, true); shape.lineTo(radius, 0);
    shape.lineTo(inner, 0); shape.lineTo(inner, spring); shape.absarc(0, spring, inner, 0, Math.PI, false); shape.lineTo(-inner, 0);
  } else {
    shape.lineTo(radius, 0); shape.lineTo(radius, spring); shape.absarc(0, spring, radius, 0, Math.PI, false);
  }
  shape.closePath();
  const geometry = new ShapeGeometry(shape, 24), uv = geometry.attributes.uv;
  for (let index = 0; index < uv.count; index++) uv.setXY(index, uv.getX(index) / width + .5, uv.getY(index) / height);
  return geometry;
}

function useRotundaResources(roomName?: string) {
  const invalidate = useThree(state => state.invalidate);
  const [resources, setResources] = useState<ReturnType<typeof create> | null>(null);
  useLayoutEffect(() => {
    const next = create(); setResources(next); invalidate();
    return () => next.dispose();
  }, [invalidate]);
  const [sign, setSign] = useState<CanvasTexture | null>(null);
  useLayoutEffect(() => {
    const texture = new CanvasTexture(drawRotundaSign(roomName)); texture.colorSpace = SRGBColorSpace;
    setSign(texture); invalidate();
    return () => texture.dispose();
  }, [roomName, invalidate]);
  return resources && sign ? { ...resources, sign } : null;
}

/** Tài nguyên GPU riêng của kiến trúc Rotunda; huỷ cùng phòng. */
function create() {
  const texture = (canvas: HTMLCanvasElement) => { const map = new CanvasTexture(canvas); map.colorSpace = SRGBColorSpace; return map; };
  const wash = texture(drawWash()), halo = texture(drawHalo()), skylight = texture(drawSkylight()), frieze = texture(drawFrieze());
  // Hắt màu là lớp phủ alpha (nhuộm tường), không cộng sáng: tường thạch cao sáng không bị cháy trắng.
  const tint = (color: string, opacity: number) => new MeshBasicMaterial({ color, map: wash, transparent: true, opacity, depthWrite: false });
  const materials = {
    amberWash: tint('#e0a45a', .6), jadeWash: tint('#3d9a87', .42), blueWash: tint('#486a87', .5),
    halo: new MeshBasicMaterial({ color: '#dfa45b', map: halo, transparent: true, opacity: .45, depthWrite: false, blending: AdditiveBlending }),
    skylight: new MeshBasicMaterial({ map: skylight }), frieze: new MeshBasicMaterial({ map: frieze, transparent: true, depthWrite: false }),
  };
  const geometries = { archFrame: archGeometry(3, 3.75, .09), arch: archGeometry(2.82, 3.66), doorFrame: archGeometry(2.7, 3.7, .1), door: archGeometry(2.5, 3.6) };
  return { ...materials, ...geometries, dispose: () => {
    [wash, halo, skylight, frieze].forEach(item => item.dispose());
    Object.values(materials).forEach(item => item.dispose()); Object.values(geometries).forEach(item => item.dispose());
  } };
}

/** Vòng trần + giếng trời giả lập. Mọi chi tiết nằm trên 4,6 m — cao hơn giới hạn camera. */
function CeilingOculus({ skylight }: { skylight: Material }) {
  const { walnut, bronze, plaster, charcoal, glow } = useGallerySurfaces();
  return <group name="Ceiling oculus" position={[CX, 0, CZ]}>
    <mesh position={[0, 4.985, 0]} rotation={[HALF_PI, 0, 0]} material={skylight}><circleGeometry args={[3.15, 64]} /></mesh>
    <mesh position={[0, 4.95, 0]} rotation={[HALF_PI, 0, 0]} material={bronze}><torusGeometry args={[3.17, .05, 8, 72]} /></mesh>
    <mesh position={[0, 4.975, 0]} rotation={[HALF_PI, 0, 0]} material={charcoal}><ringGeometry args={[3.2, 5.42, 72]} /></mesh>
    <mesh position={[0, 4.965, 0]} rotation={[HALF_PI, 0, 0]} material={glow}><ringGeometry args={[5.24, 5.42, 72]} /></mesh>
    <mesh position={[0, 4.86, 0]} rotation={[HALF_PI, 0, 0]} material={plaster}><torusGeometry args={[5.56, .14, 8, 72]} /></mesh>
    <group position={[-CX, 0, -CZ]}>
      <Instances placements={SLATS} material={walnut}><boxGeometry args={[.07, .14, 1.86]} /></Instances>
    </group>
  </group>;
}

/** Hốc vòm nông sau bốn bục cạnh, cửa vòm lối vào và hai mảng hắt màu phụ. Không lấn vào vùng đi lại. */
function WallBays({ archFrame, arch, doorFrame, door, amberWash, jadeWash, blueWash }: Record<'archFrame' | 'arch' | 'doorFrame' | 'door', ShapeGeometry> & Record<'amberWash' | 'jadeWash' | 'blueWash', Material>) {
  const { walnut, bronze, charcoal } = useGallerySurfaces();
  return <group name="Wall bays">
    <Instances placements={BAYS} material={bronze}><primitive object={archFrame} attach="geometry" /></Instances>
    <Instances placements={inward(BAYS, .012)} material={charcoal}><primitive object={arch} attach="geometry" /></Instances>
    <Instances placements={inward(BAYS, .024)} material={amberWash}><primitive object={arch} attach="geometry" /></Instances>
    <mesh position={ENTRANCE.position} rotation={[0, Math.PI, 0]} material={bronze}><primitive object={doorFrame} attach="geometry" /></mesh>
    <mesh position={[0, 0, 7.973]} rotation={[0, Math.PI, 0]} material={charcoal}><primitive object={door} attach="geometry" /></mesh>
    {/* Jade bên trái, xanh lam trầm bên phải: chỉ hắt lên tường giữa hai hốc, cách xa hiện vật. */}
    {[-1, 1].map(side => <mesh key={side} position={[side * 6.975, 2.45, -1.05]} rotation={[0, -side * HALF_PI, 0]} material={side < 0 ? jadeWash : blueWash}>
      <planeGeometry args={[2.7, 4.1]} />
    </mesh>)}
    <Instances placements={WALL_SLATS} material={walnut}><boxGeometry args={[.06, 3.9, .09]} /></Instances>
  </group>;
}

/** Vách trung tâm: mảng đá mang biển tên phòng, hai trụ gỗ với phù điêu hình học đối xứng. */
function GalleryFriezes({ frieze, amberWash, sign }: { frieze: Material; amberWash: Material; sign: CanvasTexture }) {
  const { stone, walnut, bronze } = useGallerySurfaces();
  return <group name="Gallery friezes">
    <mesh position={[0, 2.5, -7.95]} material={stone}><boxGeometry args={[5.5, 4.4, .08]} /></mesh>
    <Instances placements={PILASTERS} material={walnut}><boxGeometry args={[1.5, 4.4, .12]} /></Instances>
    <Instances placements={PILASTER_TRIMS} material={bronze}><boxGeometry args={[.04, 4.4, .05]} /></Instances>
    <Instances placements={inward(PILASTERS, .065)} material={frieze}><planeGeometry args={[1.3, 4.2]} /></Instances>
    {[-1, 1].map(side => <mesh key={side} position={[side * 5.65, 2.45, -7.975]} material={amberWash}><planeGeometry args={[2.5, 4.1]} /></mesh>)}
    <mesh position={[0, 2.5, -7.9]} material={amberWash}><planeGeometry args={[5.4, 4.3]} /></mesh>
    <mesh position={[0, 3.3, -7.89]}>
      <planeGeometry args={[5, 2.5]} /><meshBasicMaterial map={sign} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  </group>;
}

/**
 * Aura Heritage Rotunda — Rectangular Shell: giữ vỏ đi lại 14 × 16 × 5 m, tạo cảm giác không gian tròn bằng
 * vòng trần, hốc vòm, ánh sáng viền và hoạ tiết sàn đồng tâm. Chỉ dùng cho phòng theo Gallery Template.
 * Trang trí không có collider nên chỉ bám tường (≤ 0,2 m), sát sàn hoặc trên 4,6 m.
 */
export function RotundaArchitecture({ roomName }: { roomName?: string }) {
  const { plaster, bronze, charcoal, grout, glow } = useGallerySurfaces();
  const resources = useRotundaResources(roomName);
  if (!resources) return null;
  return <group name="Rotunda architecture">
    <mesh position={[0, 5.12, 0]} material={plaster}><boxGeometry args={[14.4, .24, 16.4]} /></mesh>
    <CeilingOculus skylight={resources.skylight} />
    <WallBays {...resources} />
    <GalleryFriezes {...resources} />
    <Instances placements={SIDE_SKIRTING} material={charcoal}><boxGeometry args={[.12, .3, 16]} /></Instances>
    <Instances placements={END_SKIRTING} material={charcoal}><boxGeometry args={[14, .3, .12]} /></Instances>
    <Instances placements={SIDE_CORNICE} material={plaster}><boxGeometry args={[.28, .14, 16]} /></Instances>
    <Instances placements={END_CORNICE} material={plaster}><boxGeometry args={[14, .14, .28]} /></Instances>
    <Instances placements={SIDE_COVES} material={glow}><boxGeometry args={[.03, .035, 15.9]} /></Instances>
    <Instances placements={END_COVES} material={glow}><boxGeometry args={[13.9, .035, .03]} /></Instances>
    <group name="Floor inlay" position={[CX, 0, CZ]} userData={{ xrIgnore: true }}>
      <mesh position={[0, .004, 0]} rotation={[-HALF_PI, 0, 0]} material={resources.halo} raycast={() => {}}><planeGeometry args={[5.6, 5.6]} /></mesh>
      <mesh position={[0, .003, 0]} rotation={[-HALF_PI, 0, 0]} material={grout} raycast={() => {}}><ringGeometry args={[2.46, 2.74, 72]} /></mesh>
      <mesh position={[0, .005, 0]} rotation={[-HALF_PI, 0, 0]} material={bronze} raycast={() => {}}><ringGeometry args={[1.66, 1.71, 72]} /></mesh>
      <mesh position={[0, .005, 0]} rotation={[-HALF_PI, 0, 0]} material={bronze} raycast={() => {}}><ringGeometry args={[3.86, 3.91, 96]} /></mesh>
    </group>
  </group>;
}
