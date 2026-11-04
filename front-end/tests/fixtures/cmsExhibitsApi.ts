import type { Page } from '@playwright/test';
import { installCmsSession } from './cmsSession';

/** Cùng shape với `ExhibitRow` mà `GET /admin/exhibits` trả về. */
export interface TestExhibit {
  id: string;
  roomId: string;
  status: 'draft' | 'published' | 'archived';
  visibility: 'visible' | 'hidden';
  version: number;
  displayOrder: number;
  publishedRevisionId: string | null;
  currentRevisionNo: number;
  revisionState: 'draft' | 'in_review' | 'approved' | 'rejected';
  content: {
    name: { vi: string; en: string };
    description: { vi: string; en: string };
    position: { x: number; y: number; z: number };
  };
  hotspotsCount: number;
  createdAt: string;
  updatedAt: string;
}

const NOW = new Date().toISOString();

export const initialTestExhibits: TestExhibit[] = [
  {
    id: 'exhibit-001',
    roomId: 'room-001',
    status: 'draft',
    visibility: 'visible',
    version: 1,
    displayOrder: 1,
    publishedRevisionId: null,
    currentRevisionNo: 1,
    revisionState: 'draft',
    content: {
      name: { vi: 'Súng Trường K54', en: 'K54 Rifle' },
      description: { vi: 'Vũ khí tiêu chuẩn của lực lượng quân đội.', en: 'Standard military rifle used during wartime.' },
      position: { x: 0, y: 0, z: 0 },
    },
    hotspotsCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

export async function installCmsExhibitsApi(page: Page, customExhibits: TestExhibit[] = initialTestExhibits) {
  const exhibits: TestExhibit[] = [...customExhibits];
  const writes: Array<{ method: string; path: string; data?: unknown }> = [];

  // Auth permissions
  await installCmsSession(page, ['exhibit:read', 'exhibit:create', 'exhibit:update', 'exhibit:delete', 'revision:submit', 'revision:publish', 'revision:reject', 'revision:hide', 'room:read']);

  // Rooms for select options
  await page.route('**/api/admin/rooms*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { id: 'room-001', name: 'Phòng Lịch Sử Kháng Chiến', slug: 'phong-lich-su-khang-chien', status: 'active' },
        ],
        meta: { page: 1, pageSize: 50, total: 1 },
        message: null,
      }),
    });
  });

  // Media list for selectors
  await page.route('**/api/admin/media*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [],
        meta: { page: 1, pageSize: 50, total: 0 },
        message: null,
      }),
    });
  });

  // Exhibits listing & creating
  await page.route('**/api/admin/exhibits**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    if (method === 'GET' && url.pathname.endsWith('/admin/exhibits')) {
      const q = url.searchParams.get('q')?.toLowerCase() || '';
      let filtered = exhibits;
      if (q) {
        filtered = filtered.filter((e) => e.content.name.vi.toLowerCase().includes(q) || e.content.name.en.toLowerCase().includes(q));
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

    if (method === 'POST' && url.pathname.endsWith('/admin/exhibits')) {
      const body = route.request().postDataJSON();
      writes.push({ method: 'POST', path: '/admin/exhibits', data: body });

      const newExhibit: TestExhibit = {
        ...initialTestExhibits[0],
        id: `exhibit-${Date.now()}`,
        roomId: body.roomId,
        displayOrder: body.displayOrder ?? 1,
        content: {
          name: { vi: body.name?.vi ?? '', en: body.name?.en ?? '' },
          description: { vi: body.description?.vi ?? '', en: body.description?.en ?? '' },
          position: { x: 0, y: 0, z: 0 },
        },
      };
      exhibits.unshift(newExhibit);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: newExhibit, message: null }),
      });
      return;
    }

    // Submit for review: POST /api/admin/exhibits/:id/submit-review
    if (method === 'POST' && url.pathname.includes('/submit-review')) {
      const id = url.pathname.split('/')[4];
      writes.push({ method: 'POST', path: `/admin/exhibits/${id}/submit-review` });
      const ex = exhibits.find((e) => e.id === id);
      if (ex) {
        ex.revisionState = 'in_review';
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: ex, message: 'Đã gửi duyệt thành công' }),
      });
      return;
    }

    await route.fallback();
  });

  return { getExhibits: () => exhibits, writes };
}

