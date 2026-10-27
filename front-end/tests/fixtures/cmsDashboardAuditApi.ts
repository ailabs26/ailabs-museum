import type { Page } from '@playwright/test';

export async function installCmsDashboardAuditApi(page: Page) {
  // Auth
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
          permissions: ['audit:read', 'room:read', 'exhibit:read', 'report:read'],
        },
        message: null,
      }),
    });
  });

  // GET /api/admin/stats/overview
  await page.route('**/api/admin/stats/overview*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          rooms: { total: 12, active: 10, archived: 2 },
          exhibits: { total: 45, visible: 40, hidden: 5 },
          revisions: { inReview: 4, draft: 8 },
          reports: { open: 3, inProgress: 2 },
          system: {
            api: 'up',
            db: 'up',
            uptimeSec: 36000,
            serverTime: new Date().toISOString(),
          },
        },
        message: null,
      }),
    });
  });

  // GET /api/admin/stats/charts
  await page.route('**/api/admin/stats/charts*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          reportsByStatus: [
            { label: 'open', count: 3 },
            { label: 'in_progress', count: 2 },
            { label: 'resolved', count: 15 },
          ],
          exhibitsByRoom: [
            { label: 'Phòng Lịch Sử Kháng Chiến', count: 18 },
            { label: 'Phòng Cổ Vật Đông Sơn', count: 22 },
          ],
          revisionsByState: [
            { label: 'approved', count: 35 },
            { label: 'in_review', count: 4 },
            { label: 'draft', count: 8 },
          ],
          activityLast14Days: [
            { date: '2026-10-20', revisions: 2, reports: 1 },
            { date: '2026-10-21', revisions: 4, reports: 0 },
            { date: '2026-10-22', revisions: 3, reports: 2 },
          ],
        },
        message: null,
      }),
    });
  });

  // GET /api/audit
  await page.route('**/api/audit*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.match(/\/audit\/[^/]+$/)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'audit-001',
            action: 'room.create',
            resource: 'room',
            resourceId: 'room-101',
            actorId: 'admin-id',
            actorEmail: 'admin@aura.local',
            actorName: 'Administrator',
            ip: '127.0.0.1',
            userAgent: 'Playwright Test',
            payload: { name: 'Phòng Kháng Chiến', slug: 'phong-khang-chien' },
            createdAt: new Date().toISOString(),
          },
          message: null,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            id: 'audit-001',
            action: 'room.create',
            resource: 'room',
            resourceId: 'room-101',
            actorId: 'admin-id',
            actorEmail: 'admin@aura.local',
            actorName: 'Administrator',
            ip: '127.0.0.1',
            userAgent: 'Playwright Test',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'audit-002',
            action: 'revision.publish',
            resource: 'revision',
            resourceId: 'rev-201',
            actorId: 'admin-id',
            actorEmail: 'admin@aura.local',
            actorName: 'Administrator',
            ip: '127.0.0.1',
            userAgent: 'Playwright Test',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
          },
        ],
        meta: { page: 1, pageSize: 20, total: 2 },
        message: null,
      }),
    });
  });
}

