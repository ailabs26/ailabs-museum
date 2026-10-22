import type { Page } from '@playwright/test';
import { installModerationApi, revisions } from './moderationApi';
import { fulfillMuseum } from './museumApi';
import { envelope } from './museumContent';

const timestamp = '2026-10-20T00:00:00Z';
export const overlayUser = { id: '40000000-0000-4000-8000-000000000001', email: 'sample@example.test', displayName: 'Tài khoản mẫu', status: 'active', roles: [], createdAt: timestamp, updatedAt: timestamp };
export const overlayRole = { id: '50000000-0000-4000-8000-000000000001', code: 'sample', name: 'Vai trò mẫu', permissions: [] };
export const overlayRoom = { id: '60000000-0000-4000-8000-000000000001', name: 'Phòng mẫu', slug: 'phong-mau', description: 'Mô tả mẫu', status: 'active', exhibitsCount: 0, createdAt: timestamp, updatedAt: timestamp };
export const overlayExhibit = { id: revisions[0].exhibitId, roomId: overlayRoom.id, status: 'draft', visibility: 'hidden', version: 1, displayOrder: 1, publishedRevisionId: null, currentRevisionNo: 1, revisionState: 'draft', content: { name: { vi: 'Hiện vật mẫu' }, description: { vi: 'Mô tả '.repeat(200) }, position: { x: 0, y: 0, z: 0 } }, hotspotsCount: 0, createdAt: timestamp, updatedAt: timestamp, revisions: [], hotspots: [], room: overlayRoom };
export const overlayReport = { id: '70000000-0000-4000-8000-000000000001', exhibitId: overlayExhibit.id, category: 'Nội dung sai', message: 'Báo cáo mẫu', status: 'open', assignedTo: null, resolution: null, reportedRevision: null, createdAt: timestamp, resolvedAt: null };
export const overlayAudit = { id: '80000000-0000-4000-8000-000000000001', actorId: null, actor: null, action: 'room.update', resourceType: 'room', resourceId: overlayRoom.id, revisionId: null, reason: null, requestId: 'fixture-request', occurredAt: timestamp };

export async function installOverlayApi(page: Page) {
  await installModerationApi(page, { permissions: [
    'user:read', 'user:create', 'user:update', 'user:delete', 'role:read', 'role:update', 'role:delete', 'role:assign',
    'room:read', 'room:create', 'room:update', 'room:delete', 'exhibit:read', 'exhibit:create', 'exhibit:update',
    'revision:publish', 'revision:reject', 'revision:submit', 'report:read', 'report:resolve', 'audit:read',
  ] });
  const writes: { method: string; path: string; body: unknown }[] = [];
  const lists: Record<string, unknown[]> = { '/users': [overlayUser], '/roles': [overlayRole], '/admin/rooms': [overlayRoom], '/admin/exhibits': [overlayExhibit], '/admin/media': [], '/reports': [overlayReport], '/audit': [overlayAudit] };
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.slice('/api'.length);
    if (!new URL(request.url()).pathname.startsWith('/api/') || path.startsWith('/auth/') || request.method() === 'OPTIONS') { await route.fallback(); return; }
    if (request.method() !== 'GET') {
      writes.push({ method: request.method(), path, body: request.postDataJSON() });
      const listPath = Object.keys(lists).find(key => path.startsWith(`${key}/`) || path === key);
      if (request.method() === 'DELETE' && listPath) lists[listPath] = [];
      await fulfillMuseum(route, envelope(path.startsWith('/users') ? overlayUser : path.startsWith('/admin/rooms') ? overlayRoom : path.startsWith('/admin/exhibits') ? overlayExhibit : null));
      return;
    }
    if (path in lists) { await fulfillMuseum(route, { ...envelope(lists[path]), meta: { page: 1, pageSize: 20, total: lists[path].length } }); return; }
    if (path === `/admin/exhibits/${overlayExhibit.id}`) { await fulfillMuseum(route, envelope(overlayExhibit)); return; }
    if (path === `/reports/${overlayReport.id}`) { await fulfillMuseum(route, envelope(overlayReport)); return; }
    if (path === `/moderation/revisions/${revisions[0].id}`) { await fulfillMuseum(route, envelope({ ...revisions[0], exhibit: { id: overlayExhibit.id, version: 1 } })); return; }
    await route.fallback();
  });
  return { writes, lists };
}
