import type { Page } from '@playwright/test';

export interface TestRevision {
  id: string;
  exhibitId: string;
  revisionNo: number;
  state: 'draft' | 'in_review' | 'approved' | 'rejected';
  content: {
    name: { vi: string; en: string };
    description: { vi: string; en: string };
    position: { x: number; y: number; z: number };
  };
  createdBy: { id: string; displayName: string } | null;
  reviewedBy: { id: string; displayName: string } | null;
  reason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export const initialTestRevisions: TestRevision[] = [
  {
    id: 'rev-001',
    exhibitId: 'exhibit-001',
    revisionNo: 2,
    state: 'in_review',
    content: {
      name: { vi: 'Trống Đồng Ngọc Lũ', en: 'Ngoc Lu Bronze Drum' },
      description: { vi: 'Bảo vật quốc gia thời kỳ Đông Sơn đỉnh cao.', en: 'National treasure of Dong Son civilization.' },
      position: { x: 0, y: 0, z: -2 },
    },
    createdBy: { id: 'editor-1', displayName: 'Biên tập viên A' },
    reviewedBy: null,
    reason: null,
    reviewedAt: null,
    createdAt: new Date().toISOString(),
  },
];

export async function installCmsModerationConcurrencyApi(
  page: Page,
  options: { simulate409OnPublish?: boolean } = {},
) {
  let queue: TestRevision[] = [...initialTestRevisions];
  const writes: Array<{ method: string; path: string; data?: unknown }> = [];

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: 'moderator-id',
          email: 'moderator@aura.local',
          displayName: 'Moderator',
          roles: ['moderator'],
          permissions: ['revision:publish', 'revision:reject', 'revision:hide', 'revision:read'],
        },
        message: null,
      }),
    });
  });

  // GET /api/moderation/queue
  await page.route('**/api/moderation/queue*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: queue,
        meta: { page: 1, pageSize: 20, total: queue.length },
        message: null,
      }),
    });
  });

  // GET /api/moderation/revisions/:id
  await page.route(/.*\/api\/moderation\/revisions\/[^/]+$/, async (route) => {
    const id = route.request().url().split('/').pop()!;
    const rev = queue.find((r) => r.id === id) || queue[0];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: rev, message: null }),
    });
  });

  // GET /api/moderation/revisions/:id/diff
  await page.route(/.*\/api\/moderation\/revisions\/[^/]+\/diff$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          publishedRevisionNo: 1,
          targetRevisionNo: 2,
          fields: [
            { field: 'name.vi', old: 'Trống Đồng', new: 'Trống Đồng Ngọc Lũ' },
            { field: 'description.vi', old: 'Hiện vật cổ', new: 'Bảo vật quốc gia thời kỳ Đông Sơn đỉnh cao.' },
          ],
        },
        message: null,
      }),
    });
  });

  // GET /api/exhibits/:id/revisions (history)
  await page.route(/.*\/api\/exhibits\/[^/]+\/revisions$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { revisionNo: 1, state: 'approved', createdAt: '2026-10-10T10:00:00Z', reviewedAt: '2026-10-10T12:00:00Z' },
          { revisionNo: 2, state: 'in_review', createdAt: '2026-10-15T09:00:00Z', reviewedAt: null },
        ],
        message: null,
      }),
    });
  });

  // POST /api/revisions/:id/publish
  await page.route(/.*\/api\/revisions\/[^/]+\/publish$/, async (route) => {
    const url = route.request().url();
    writes.push({ method: 'POST', path: url, data: route.request().postDataJSON() });

    if (options.simulate409OnPublish) {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          data: null,
          message: 'Nội dung đã bị thay đổi bởi người khác hoặc phiên bản không khớp. Vui lòng tải lại trang.',
        }),
      });
      return;
    }

    queue = queue.filter((r) => !url.includes(r.id));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { status: 'approved' }, message: 'Đã xuất bản thành công' }),
    });
  });

  // POST /api/revisions/:id/reject
  await page.route(/.*\/api\/revisions\/[^/]+\/reject$/, async (route) => {
    const body = route.request().postDataJSON();
    writes.push({ method: 'POST', path: route.request().url(), data: body });
    queue = [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { status: 'rejected' }, message: 'Đã từ chối phiên bản' }),
    });
  });

  return { getQueue: () => queue, writes };
}

