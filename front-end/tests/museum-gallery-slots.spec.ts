import { expect, test, type Page } from '@playwright/test';
import { fulfillMuseum, installMuseumApi } from './fixtures/museumApi';
import { envelope, exhibit, ROOM_C_ID, roomC } from './fixtures/museumContent';
import { installRendererProbe, waitForGallerySurfaces } from './fixtures/museumProbe';
import { museumExhibitButton, selectMuseumExhibit } from './fixtures/museumUi';

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
