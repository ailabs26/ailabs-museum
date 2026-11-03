import type { Page } from '@playwright/test';
import { fulfillMuseum } from './museumApi';
import { envelope } from './museumContent';

/** Đúng hợp đồng `ReportResponseDto` của back-end (xem docs/architecture/06-api-contract.md). */
export interface TestContentReport {
  id: string;
  exhibitId: string;
  category: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
  assignedTo: { id: string; email: string; displayName: string } | null;
  resolution: string | null;
  reportedRevision: { id: string; revisionNo: number; state: string; content: Record<string, unknown> } | null;
  createdAt: string;
  resolvedAt: string | null;
}

export const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@aura.local', displayName: 'Administrator' };

const initialReports = (): TestContentReport[] => [
  {
    id: '50000000-0000-4000-8000-000000000001',
    exhibitId: '10000000-0000-4000-8000-000000000001',
    category: 'wrong_info',
    message: 'Mô tả hiện vật có thông tin niên đại lịch sử chưa chính xác.',
    status: 'open',
    assignedTo: null,
    resolution: null,
    reportedRevision: {
      id: '30000000-0000-4000-8000-000000000001', revisionNo: 3, state: 'approved',
      content: { name: { vi: 'Trống Đồng Đông Sơn', en: 'Dong Son Drum' }, description: { vi: 'Trống đồng thời Hùng Vương', en: null } },
    },
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  },
  {
    id: '50000000-0000-4000-8000-000000000002',
    exhibitId: '10000000-0000-4000-8000-000000000002',
    category: 'typo',
    message: 'Sai chính tả ở tên hiện vật.',
    status: 'resolved',
    assignedTo: ADMIN,
    resolution: 'Đã sửa chính tả.',
    reportedRevision: null,
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    resolvedAt: new Date().toISOString(),
  },
];

/**
 * API giả có trạng thái cho trang Báo cáo vi phạm: phiên admin (401 → refresh → me như thật), danh sách lọc theo
 * trạng thái, chi tiết, tiếp nhận / xử lý xong / đóng. Mọi request /api/ khác trả rỗng — không chạm back-end thật.
 */
export async function installCmsReportsWorkflowApi(page: Page) {
  const reports = initialReports();
  const writes: Array<{ method: string; path: string; data?: unknown }> = [];

  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api', '');
    const method = request.method();
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: {
        'Access-Control-Allow-Origin': request.headers().origin ?? 'http://127.0.0.1:4173',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'authorization,content-type',
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      } });
      return;
    }
    if (path === '/auth/refresh') return fulfillMuseum(route, envelope({ accessToken: 'reports-fixture-token' }));
    if (path === '/auth/me') {
      return request.headers().authorization
        ? fulfillMuseum(route, envelope({ ...ADMIN, roles: ['admin'], permissions: ['report:read', 'report:resolve'] }))
        : fulfillMuseum(route, { success: false, data: null, message: 'Unauthenticated' }, 401);
    }
    if (path === '/admin/stats/overview') {
      return fulfillMuseum(route, envelope({
        rooms: { total: 0, active: 0, archived: 0 }, exhibits: { total: 0, visible: 0, hidden: 0 },
        revisions: { inReview: 0, draft: 0 },
        reports: { open: reports.filter((r) => r.status === 'open').length, inProgress: 0 },
        system: { api: 'up', db: 'up', uptimeSec: 1, serverTime: new Date().toISOString() },
      }));
    }
    if (path === '/reports' && method === 'GET') {
      const status = url.searchParams.get('status');
      const items = status ? reports.filter((r) => r.status === status) : reports;
      return fulfillMuseum(route, { ...envelope(items), meta: { page: 1, pageSize: 20, total: items.length } });
    }
    if (path === '/reports/assignees') return fulfillMuseum(route, envelope([ADMIN]));

    const action = /^\/reports\/([^/]+)\/(assign|resolve|dismiss)$/.exec(path);
    if (action && method === 'POST') {
      const [, id, kind] = action;
      const body = request.postDataJSON() as { resolution?: string; assigneeId?: string } | null;
      writes.push({ method, path, data: body });
      const item = reports.find((r) => r.id === id)!;
      if (kind === 'assign') {
        item.status = 'in_progress';
        item.assignedTo = ADMIN;
      } else {
        item.status = kind === 'resolve' ? 'resolved' : 'dismissed';
        item.resolution = body?.resolution ?? null;
        item.resolvedAt = new Date().toISOString();
        item.assignedTo ??= ADMIN;
      }
      return fulfillMuseum(route, envelope(item));
    }
    const detail = /^\/reports\/([^/]+)$/.exec(path);
    if (detail && method === 'GET') return fulfillMuseum(route, envelope(reports.find((r) => r.id === detail[1])));

    return fulfillMuseum(route, { ...envelope([]), meta: { page: 1, pageSize: 20, total: 0 } });
  });

  return { getReports: () => reports, writes };
}
