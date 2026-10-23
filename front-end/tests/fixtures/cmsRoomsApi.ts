import type { Page } from '@playwright/test';

export interface TestRoom {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: 'active' | 'archived';
  isDeleted: boolean;
  exhibitCount?: number;
  createdAt: string;
  updatedAt: string;
}

export const initialTestRooms: TestRoom[] = [
  {
    id: '11111111-2222-3333-4444-555555555551',
    name: 'Phòng Lịch Sử Kháng Chiến',
    slug: 'phong-lich-su-khang-chien',
    description: 'Trưng bày các hiện vật lịch sử kháng chiến hào hùng',
    status: 'active',
    isDeleted: false,
    exhibitCount: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '11111111-2222-3333-4444-555555555552',
    name: 'Phòng Cổ Vật Đông Sơn',
    slug: 'phong-co-vat-dong-son',
    description: 'Trưng bày văn hóa Đông Sơn thời kỳ tiền sử',
    status: 'archived',
    isDeleted: false,
    exhibitCount: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export async function installCmsRoomsApi(page: Page, customRooms: TestRoom[] = initialTestRooms) {
  let rooms: TestRoom[] = [...customRooms];
  const writes: Array<{ method: string; path: string; data?: unknown }> = [];

  // Giả lập quyền Admin đầy đủ
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: 'admin-user-id',
          email: 'admin@aura.local',
          displayName: 'Administrator',
          roles: ['admin'],
          permissions: ['room:read', 'room:create', 'room:update', 'room:delete'],
        },
        message: null,
      }),
    });
  });

  // GET /api/admin/rooms
  await page.route('**/api/admin/rooms*', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    if (method === 'GET') {
      const q = url.searchParams.get('q')?.toLowerCase() || '';
      const status = url.searchParams.get('status') || 'all';

      let filtered = rooms.filter((r) => !r.isDeleted);
      if (q) {
        filtered = filtered.filter((r) => r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q));
      }
      if (status !== 'all') {
        filtered = filtered.filter((r) => r.status === status);
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: filtered,
          meta: { page: 1, pageSize: 20, total: filtered.length },
          message: null,
        }),
      });
      return;
    }

    if (method === 'POST') {
      const body = route.request().postDataJSON();
      writes.push({ method: 'POST', path: '/admin/rooms', data: body });

      const newRoom: TestRoom = {
        id: `room-${Date.now()}`,
        name: body.name,
        slug: body.slug,
        description: body.description ?? null,
        status: body.status ?? 'active',
        isDeleted: false,
        exhibitCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      rooms.unshift(newRoom);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: newRoom, message: null }),
      });
      return;
    }

    await route.continue();
  });

  // PATCH / DELETE /api/admin/rooms/:id
  await page.route(/.*\/api\/admin\/rooms\/[^/]+$/, async (route) => {
    const method = route.request().method();
    const url = new URL(route.request().url());
    const id = url.pathname.split('/').pop()!;

    if (method === 'PATCH') {
      const body = route.request().postDataJSON();
      writes.push({ method: 'PATCH', path: `/admin/rooms/${id}`, data: body });
      const idx = rooms.findIndex((r) => r.id === id);
      if (idx >= 0) {
        rooms[idx] = { ...rooms[idx], ...body, updatedAt: new Date().toISOString() };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: rooms[idx], message: null }),
        });
      } else {
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Room not found' }) });
      }
      return;
    }

    if (method === 'DELETE') {
      writes.push({ method: 'DELETE', path: `/admin/rooms/${id}` });
      rooms = rooms.filter((r) => r.id !== id);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: null, message: 'Xóa thành công' }),
      });
      return;
    }

    await route.continue();
  });

  return { getRooms: () => rooms, writes };
}

