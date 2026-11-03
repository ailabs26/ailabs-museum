import type { Page } from '@playwright/test';

export interface TestExhibit {
  id: string;
  roomId: string;
  roomName: string;
  name: string;
  nameVi: string;
  nameEn: string;
  descriptionVi: string;
  descriptionEn: string;
  displayOrder: number;
  status: 'draft' | 'in_review' | 'approved' | 'rejected';
  visibility: 'visible' | 'hidden';
  version: number;
  hasDraftRevision: boolean;
  publishedRevisionId?: string;
  latestRevisionId?: string;
}

export const initialTestExhibits: TestExhibit[] = [
  {
    id: 'exhibit-001',
    roomId: 'room-001',
    roomName: 'Phòng Lịch Sử Kháng Chiến',
    name: 'Súng Trường K54',
    nameVi: 'Súng Trường K54',
    nameEn: 'K54 Rifle',
    descriptionVi: 'Vũ khí tiêu chuẩn của lực lượng quân đội.',
    descriptionEn: 'Standard military rifle used during wartime.',
    displayOrder: 1,
    status: 'draft',
    visibility: 'visible',
    version: 1,
    hasDraftRevision: true,
    latestRevisionId: 'rev-001',
  },
];

export async function installCmsExhibitsApi(page: Page, customExhibits: TestExhibit[] = initialTestExhibits) {
  const exhibits: TestExhibit[] = [...customExhibits];
  const writes: Array<{ method: string; path: string; data?: unknown }> = [];

  // Auth permissions
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
          permissions: ['exhibit:read', 'exhibit:create', 'exhibit:update', 'exhibit:delete', 'revision:submit', 'revision:publish', 'revision:reject', 'revision:hide', 'room:read'],
        },
        message: null,
      }),
    });
  });

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
  await page.route('**/api/admin/exhibits*', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    if (method === 'GET' && !url.pathname.includes('/revisions') && !url.pathname.includes('/preview')) {
      const q = url.searchParams.get('q')?.toLowerCase() || '';
      let filtered = exhibits;
      if (q) {
        filtered = filtered.filter((e) => e.nameVi.toLowerCase().includes(q) || e.nameEn.toLowerCase().includes(q));
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
        id: `exhibit-${Date.now()}`,
        roomId: body.roomId,
        roomName: 'Phòng Lịch Sử Kháng Chiến',
        name: body.content?.name?.vi || 'Hiện vật mới',
        nameVi: body.content?.name?.vi || 'Hiện vật mới',
        nameEn: body.content?.name?.en || 'New Exhibit',
        descriptionVi: body.content?.description?.vi || '',
        descriptionEn: body.content?.description?.en || '',
        displayOrder: body.displayOrder || 1,
        status: 'draft',
        visibility: 'visible',
        version: 1,
        hasDraftRevision: true,
        latestRevisionId: `rev-${Date.now()}`,
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
        ex.status = 'in_review';
        ex.hasDraftRevision = false;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: ex, message: 'Đã gửi duyệt thành công' }),
      });
      return;
    }

    await route.continue();
  });

  return { getExhibits: () => exhibits, writes };
}

