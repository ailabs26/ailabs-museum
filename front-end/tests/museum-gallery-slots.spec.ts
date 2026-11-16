import { expect, test, type Page } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, exhibit, ROOM_C_ID, roomC } from './fixtures/museumContent';
import { installRendererProbe, readRendererProbe, waitForGallerySurfaces, waitForRendererIdle } from './fixtures/museumProbe';
import { museumExhibitButton, selectMuseumExhibit } from './fixtures/museumUi';
import { installFiveModels } from './fixtures/museumGlb';
import { ROTUNDA_CLEARANCE } from '../src/helpers/rotundaClearance';

test.setTimeout(60_000);

// Gallery Template V1 — khớp `GALLERY_SLOTS` (S01…S05).
const SLOTS: [number, number][] = [[0, -2], [-4.3, -4.2], [4.3, -4.2], [-4.3, 2.1], [4.3, 2.1]];
function onSlots(count: number) {
  // Thứ tự trưng bày đảo ngược so với số bục: bục do tọa độ quyết định.
  return Array.from({ length: count }, (_, index) => ({
    ...exhibit(index + 1, ROOM_C_ID), displayOrder: count - index, positionX: SLOTS[index][0], positionZ: SLOTS[index][1],
  }));
}
async function openRoom(page: Page, exhibits: unknown[]) {
  await installMuseumApi(page); await installRendererProbe(page);
  await page.route('**/api/rooms/empty', route => fulfillMuseum(route, envelope({ ...roomC, exhibits })));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tour?room=empty');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  const canvas = page.getByLabel('Phòng trưng bày 3D', { exact: true });
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await waitForGallerySurfaces(page);
  return canvas;
}
/** Bục đang dựng trong scene: [slotId, x, z, exhibit id | null]. */
async function readSlots(page: Page) {
  return page.evaluate(() => {
    const found: [string, number, number, string | null][] = [];
    window.museumProbe.at(-1)?.scene?.deref()?.traverse(object => {
      if (typeof object.userData.gallerySlot === 'string') found.push([object.userData.gallerySlot, object.position.x, object.position.z, object.userData.artifactId ?? null]);
    });
    return found.sort((a, b) => a[0].localeCompare(b[0]));
  });
}
const cameraZ = (page: Page) => page.evaluate(() => window.museumProbe.at(-1)!.camera!.deref()!.position.z);

test('a room without exhibits still opens in 3D with exactly five empty plinths', async ({ page }, info) => {
  const canvas = await openRoom(page, []);
  await expect(page.locator('[data-gallery-layout]')).toHaveAttribute('data-gallery-layout', 'slotted');
  await expect.poll(() => readSlots(page)).toEqual(SLOTS.map(([x, z], index) => [`S0${index + 1}`, x, z, null]));
  await expect(page.getByText('Phòng này chưa có hiện vật được xuất bản.')).toBeAttached();
  await expect(page.locator('#museum-catalogue li')).toHaveCount(0);
  await expect(page.locator('audio')).toHaveCount(0);
  // Bục trống vẫn là vật cản: đi thẳng từ lối vào không xuyên qua bục trung tâm (mép trước z = -0.53).
  await canvas.focus();
  await page.keyboard.down('w'); await page.waitForTimeout(4500); await page.keyboard.up('w');
  expect(await cameraZ(page)).toBeGreaterThan(-0.54);
  expect(await cameraZ(page)).toBeLessThan(5);
  // Bấm vào bục trống không mở chi tiết nào.
  await page.getByRole('button', { name: 'Góc nhìn ban đầu', exact: true }).click();
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.55);
  await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('slots-empty.png') });
});

for (const count of [1, 2, 5]) {
  test(`${count} assigned exhibit(s) sit on their own plinths and the others stay`, async ({ page }, info) => {
    await openRoom(page, onSlots(count));
    await expect(page.locator('[data-gallery-layout]')).toHaveAttribute('data-gallery-layout', 'slotted');
    await expect.poll(() => readSlots(page)).toEqual(SLOTS.map(([x, z], index) =>
      [`S0${index + 1}`, x, z, index < count ? exhibit(index + 1).id : null]));
    await expect(page.locator('#museum-catalogue li')).toHaveCount(count);
    await selectMuseumExhibit(page, `Xem chi tiết Hiện vật ${count}`);
    await expect(page.getByRole('complementary', { name: 'Chi tiết hiện vật' })).toContainText(`Hiện vật ${count}`);
    await page.screenshot({ path: info.outputPath(`slots-${count}.png`) });
  });
}

test('unassigning an exhibit keeps its plinth', async ({ page }) => {
  let exhibits = onSlots(2);
  await installMuseumApi(page); await installRendererProbe(page);
  await page.route('**/api/rooms/empty', route => fulfillMuseum(route, envelope({ ...roomC, exhibits })));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tour?room=empty');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await readSlots(page)).filter(slot => slot[3]).length).toBe(2);
  exhibits = exhibits.slice(1);
  await page.locator('[data-catalogue] summary').click();
  await page.locator('[data-catalogue]').getByRole('button', { name: 'Làm mới' }).click();
  await expect.poll(() => readSlots(page)).toEqual(SLOTS.map(([x, z], index) =>
    [`S0${index + 1}`, x, z, index === 1 ? exhibit(2).id : null]));
});

test('free coordinates, duplicates and more than five exhibits stay in the legacy layout with nothing hidden', async ({ page }) => {
  const cases: { name: string; exhibits: ReturnType<typeof onSlots> }[] = [
    { name: 'free', exhibits: [{ ...onSlots(1)[0] }, { ...exhibit(2, ROOM_C_ID), positionX: 2, positionZ: 4 }] },
    { name: 'duplicate', exhibits: [onSlots(1)[0], { ...exhibit(2, ROOM_C_ID), positionX: 0, positionZ: -2 }] },
    { name: 'six', exhibits: [...onSlots(5), { ...exhibit(6, ROOM_C_ID), positionX: 0, positionZ: 4.5 }] },
  ];
  for (const { exhibits } of cases) {
    await openRoom(page, exhibits);
    await expect(page.locator('[data-gallery-layout]')).toHaveAttribute('data-gallery-layout', 'legacy');
    expect(await readSlots(page)).toEqual([]);
    await expect.poll(() => page.evaluate(() => {
      const ids = new Set<string>();
      window.museumProbe.at(-1)?.scene?.deref()?.traverse(object => { if (typeof object.userData.artifactId === 'string') ids.add(object.userData.artifactId); });
      return ids.size;
    })).toBe(exhibits.length);
    await expect(page.locator('#museum-catalogue li')).toHaveCount(exhibits.length);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  }
});

test('existing free-placement fixture rooms keep the legacy layout', async ({ page }) => {
  await installMuseumApi(page); await installRendererProbe(page);
  await page.goto('/tour?room=ceramics');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-gallery-layout]')).toHaveAttribute('data-gallery-layout', 'legacy');
  await expect(museumExhibitButton(page, 'Xem chi tiết Bình gốm')).toBeAttached();
});

test('template rooms use the Rotunda shell, a single shadow caster and stay within the render budget', async ({ page }) => {
  await openRoom(page, onSlots(5));
  await waitForRendererIdle(page);
  const scene = await page.evaluate(() => {
    const record = window.museumProbe.at(-1)!, root = record.scene!.deref()!;
    const names = new Set<string>(), materials = new Set<string>(), lights: Record<string, number> = {};
    let instanced = 0, shadowCasters = 0;
    root.traverse(object => {
      if (object.name) names.add(object.name);
      if ('isInstancedMesh' in object) instanced++;
      if ('isLight' in object) {
        lights[object.type] = (lights[object.type] ?? 0) + 1;
        if (object.castShadow) shadowCasters++;
      }
      const value = (object as import('three').Mesh).material;
      for (const material of !value ? [] : Array.isArray(value) ? value : [value]) if (material.name) materials.add(material.name);
    });
    const { render, memory } = record.renderer.deref()!.info;
    return { names: [...names], materials: [...materials], lights, instanced, shadowCasters,
      calls: render.calls, triangles: render.triangles, geometries: memory.geometries, textures: memory.textures };
  });
  expect(scene.names).toEqual(expect.arrayContaining(['Rotunda architecture', 'Ceiling oculus', 'Wall bays', 'Gallery friezes', 'Gallery slots']));
  expect(scene.materials).toEqual(expect.arrayContaining(['Gallery honed floor', 'Gallery lime plaster', 'Gallery walnut', 'Gallery brushed bronze', 'Gallery amber cove']));
  expect(scene.instanced).toBeGreaterThanOrEqual(12);
  expect(scene.shadowCasters).toBeLessThanOrEqual(1);
  const tier = await page.locator('[data-quality-tier]').getAttribute('data-quality-tier');
  // Đèn cố định theo tier, không tăng theo số hiện vật: 5 đèn bục + 2 hắt màu (balanced) hoặc 3 đèn (low).
  expect(scene.lights.SpotLight).toBe(tier === 'low' ? 3 : 5);
  expect(scene.lights.PointLight ?? 0).toBe(tier === 'low' ? 0 : 2);
  expect(scene.lights.DirectionalLight).toBe(1);
  expect(scene.calls).toBeLessThanOrEqual(95);
  expect(scene.triangles).toBeLessThanOrEqual(25_000);
  expect(scene.geometries).toBeLessThanOrEqual(90);
  expect(scene.textures).toBeLessThanOrEqual(22);
});

test('reopening a template room releases its GPU resources and sleeps when idle', async ({ page }) => {
  await openRoom(page, onSlots(2));
  const usage = async () => {
    await waitForGallerySurfaces(page); await waitForRendererIdle(page);
    const { geometries, textures, materials, objects } = (await readRendererProbe(page)).at(-1)!;
    return { geometries, textures, materials, objects };
  };
  const first = await usage();
  for (let round = 0; round < 3; round++) {
    await page.getByRole('button', { name: 'Thoát tham quan' }).click();
    await expect.poll(async () => (await readRendererProbe(page)).filter(item => item.live).length).toBe(0);
    await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
    await expect(page.getByLabel('Phòng trưng bày 3D', { exact: true })).toBeVisible({ timeout: 30_000 });
    expect(await usage()).toEqual(first);
  }
  const frames = (await readRendererProbe(page)).at(-1)!.frames;
  await page.waitForTimeout(600);
  expect((await readRendererProbe(page)).at(-1)!.frames).toBe(frames);
});

/**
 * Đo hình học thật: hộp bao từng chi tiết trang trí Rotunda (từng instance) và khối vật lý của từng hiện vật
 * (bục + mô hình, bỏ nhãn/hotspot/decal sàn). Trả về chi tiết nằm trong vùng trống và các cặp chạm nhau.
 */
async function measureRotundaFit(page: Page) {
  return page.evaluate((c) => {
    type Box = import('three').Box3;
    const root = window.museumProbe.at(-1)!.scene!.deref()!;
    root.updateMatrixWorld(true);
    let shell: import('three').Object3D | undefined;
    root.traverse(object => { if (object.name === 'Rotunda architecture') shell = object; });
    if (!shell) return null;
    const boxOf = (mesh: import('three').Mesh, matrix?: import('three').Matrix4) => {
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox!.clone();
      if (matrix) box.applyMatrix4(matrix);
      return box.applyMatrix4(mesh.matrixWorld);
    };
    const decor: { name: string; box: Box }[] = [];
    shell.traverse(object => {
      const mesh = object as import('three').InstancedMesh;
      if (!('isMesh' in mesh) || !mesh.visible) return;
      if (mesh.isInstancedMesh) {
        const matrix = mesh.matrixWorld.clone().identity();
        for (let index = 0; index < mesh.count; index++) { mesh.getMatrixAt(index, matrix); decor.push({ name: `${mesh.parent?.name}#${index}`, box: boxOf(mesh, matrix) }); }
      } else decor.push({ name: mesh.parent?.name ?? '', box: boxOf(mesh) });
    });
    const outsideClearance = ({ box }: { box: Box }) => box.max.y <= c.floorDecalTopY || box.min.y >= c.ceilingY
      || (box.min.y >= c.wallTrimTopY && (box.min.x >= c.upperSideWallX || box.max.x <= -c.upperSideWallX || box.min.z >= c.upperEndWallZ || box.max.z <= -c.upperEndWallZ))
      || box.min.x >= c.sideWallX || box.max.x <= -c.sideWallX || box.min.z >= c.endWallZ || box.max.z <= -c.endWallZ;
    const intruders = decor.filter(item => !outsideClearance(item)).map(item => `${item.name} ${item.box.min.toArray().map(v => v.toFixed(2))}..${item.box.max.toArray().map(v => v.toFixed(2))}`);
    const exhibits: { id: string; box: Box }[] = [];
    root.traverse(object => {
      if (typeof object.userData.artifactId !== 'string' || !('isMesh' in object) || object.userData.xrIgnore || object.userData.museumLabel) return;
      for (let node: import('three').Object3D | null = object; node; node = node.parent) if (typeof node.userData.hotspotId === 'string') return;
      const box = boxOf(object as import('three').Mesh);
      if (box.max.y > c.floorDecalTopY) exhibits.push({ id: object.userData.artifactId, box });
    });
    // Khối nội dung (mô hình, khối tạm) mang userData của group cha; gom theo group gần nhất có artifactId.
    root.traverse(object => {
      if (!('isMesh' in object) || object.userData.artifactId || object.userData.museumLabel) return;
      let owner: string | undefined, isHotspot = false, isDecal = false;
      for (let node: import('three').Object3D | null = object; node; node = node.parent) {
        if (typeof node.userData.hotspotId === 'string') isHotspot = true;
        if (node.userData.xrIgnore) isDecal = true;
        if (!owner && typeof node.userData.artifactId === 'string') owner = node.userData.artifactId;
      }
      if (!owner || isHotspot || isDecal || (object as import('three').Sprite).isSprite) return;
      const box = boxOf(object as import('three').Mesh);
      if (box.max.y > c.floorDecalTopY) exhibits.push({ id: owner, box });
    });
    const collisions: string[] = [];
    for (const item of decor) if (item.box.max.y > c.floorDecalTopY) for (const exhibit of exhibits) {
      if (item.box.intersectsBox(exhibit.box)) collisions.push(`${item.name} × ${exhibit.id}`);
    }
    return { decor: decor.length, exhibitParts: exhibits.length, exhibitIds: new Set(exhibits.map(item => item.id)).size, intruders, collisions };
  }, ROTUNDA_CLEARANCE);
}

test('free-placement rooms also get the Rotunda shell without decoration touching any plinth or model', async ({ page }, info) => {
  for (const room of ['sculpture', 'ceramics', 'empty']) {
    await installMuseumApi(page); await installRendererProbe(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/tour?room=${room}`);
    await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
    await expect(page.getByLabel('Phòng trưng bày 3D', { exact: true })).toBeVisible({ timeout: 30_000 });
    await waitForGallerySurfaces(page);
    await expect(page.locator('[data-gallery-layout]')).toHaveAttribute('data-gallery-layout', room === 'empty' ? 'slotted' : 'legacy');
    const fit = (await measureRotundaFit(page))!;
    expect(fit, room).not.toBeNull();
    expect(fit.decor).toBeGreaterThanOrEqual(140);
    expect(fit.intruders, room).toEqual([]);
    expect(fit.collisions, room).toEqual([]);
    expect(fit.exhibitIds).toBe(room === 'sculpture' ? 5 : room === 'ceramics' ? 1 : 0);
    if (room === 'sculpture') await page.screenshot({ path: info.outputPath('rotunda-legacy-sculpture.png') });
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  }
});

test('legacy GLB room: Rotunda shell, spots aimed at the real exhibits, no collision with loaded models', async ({ page }, info) => {
  await installFiveModels(page); await installRendererProbe(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tour?room=sculpture');
  await page.getByRole('button', { name: 'Mở phòng 3D' }).click();
  await expect(page.getByLabel('Phòng trưng bày 3D', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Đã tải 5/5 mô hình 3D', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-gallery-layout]')).toHaveAttribute('data-gallery-layout', 'legacy');
  const fit = (await measureRotundaFit(page))!;
  expect(fit.intruders).toEqual([]);
  expect(fit.collisions).toEqual([]);
  expect(fit.exhibitIds).toBe(5);
  const tier = await page.locator('[data-quality-tier]').getAttribute('data-quality-tier');
  const spots = await page.evaluate(() => {
    const targets: number[][] = [];
    window.museumProbe.at(-1)!.scene!.deref()!.traverse(object => {
      if ((object as import('three').SpotLight).isSpotLight) targets.push((object as import('three').SpotLight).target.position.toArray().map(v => +v.toFixed(2)));
    });
    return targets.map(([x, , z]) => [x, z]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  });
  if (tier === 'low') expect(spots).toHaveLength(3);
  else expect(spots).toEqual([[-3.6, -2], [-1.8, 2], [0, -2], [1.8, 2], [3.6, -2]]);
  await page.screenshot({ path: info.outputPath('rotunda-legacy-glb.png') });
});
