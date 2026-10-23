import type { Page } from '@playwright/test';

export interface TestContentReport {
  id: string;
  exhibitId: string;
  revisionId: string;
  exhibitName: string;
  reason: string;
  contactEmail: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
  assignedTo: { id: string; displayName: string } | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export const initialTestReports: TestContentReport[] = [
  {
    id: 'report-001',
    exhibitId: 'exhibit-001',
    revisionId: 'rev-001',
    exhibitName: 'Trống Đồng Đông Sơn',
    reason: 'Mô tả hiện vật có thông tin niên đại lịch sử chưa chính xác.',
    contactEmail: 'visitor@example.com',
    status: 'open',
    assignedTo: null,
    resolutionNotes: null,
    resolvedAt: null,
    createdAt: new Date().toISOString(),
  },
];

export async function installCmsReportsWorkflowApi(page: Page) {
  let reports: TestContentReport[] = [...initialTestReports];
  const writes: Array<{ method: string; path: string; data?: unknown }> = [];

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: 'admin-id',
          email: 'admin@aura.local',
          displayName: 'Administrator',
          roles: ['admin'],
          permissions: ['report:read', 'report:resolve'],
        },
        message: null,
      }),
    });
  });

  // GET /api/reports
  await page.route('**/api/reports*', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    if (method === 'GET' && !url.pathname.includes('/assign') && !url.pathname.includes('/resolve') && !url.pathname.includes('/dismiss')) {
      const status = url.searchParams.get('status') || 'all';
      let filtered = reports;
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

    await route.continue();
  });

  // GET /api/reports/:id
  await page.route(/.*\/api\/reports\/report-[^/]+$/, async (route) => {
    const id = route.request().url().split('/').pop()!;
    const item = reports.find((r) => r.id === id) || reports[0];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: item, message: null }),
    });
  });

  // POST /api/reports/:id/assign
  await page.route(/.*\/api\/reports\/[^/]+\/assign$/, async (route) => {
    const id = route.request().url().split('/')[4];
    writes.push({ method: 'POST', path: `/reports/${id}/assign` });
    const item = reports.find((r) => r.id === id);
    if (item) {
      item.status = 'in_progress';
      item.assignedTo = { id: 'admin-id', displayName: 'Administrator' };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: item, message: 'Đã tiếp nhận báo cáo' }),
    });
  });

  // POST /api/reports/:id/resolve
  await page.route(/.*\/api\/reports\/[^/]+\/resolve$/, async (route) => {
    const id = route.request().url().split('/')[4];
    const body = route.request().postDataJSON();
    writes.push({ method: 'POST', path: `/reports/${id}/resolve`, data: body });
    const item = reports.find((r) => r.id === id);
    if (item) {
      item.status = 'resolved';
      item.resolutionNotes = body.resolutionNotes;
      item.resolvedAt = new Date().toISOString();
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: item, message: 'Đã xử lý báo cáo thành công' }),
    });
  });

  // POST /api/public/reports (Client submit)
  await page.route('**/api/public/reports*', async (route) => {
    const body = route.request().postDataJSON();
    writes.push({ method: 'POST', path: '/public/reports', data: body });
    const newReport: TestContentReport = {
      id: `report-${Date.now()}`,
      exhibitId: body.exhibitId,
      revisionId: body.revisionId || 'rev-latest',
      exhibitName: 'Hiện vật được báo cáo',
      reason: body.reason,
      contactEmail: body.contactEmail || null,
      status: 'open',
      assignedTo: null,
      resolutionNotes: null,
      resolvedAt: null,
      createdAt: new Date().toISOString(),
    };
    reports.unshift(newReport);

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: newReport, message: 'Cảm ơn bạn đã gửi báo cáo' }),
    });
  });

  return { getReports: () => reports, writes };
}

