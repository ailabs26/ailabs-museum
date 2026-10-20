import type { Page } from '@playwright/test';
import { fulfillMuseum } from './museumApi';
import { envelope } from './museumContent';

export const revisions = [1, 2].map(index => ({
  id: `30000000-0000-4000-8000-00000000000${index}`,
  exhibitId: `10000000-0000-4000-8000-00000000000${index}`,
  revisionNo: index, state: 'in_review',
  content: { name: 'Bình gốm', description: `Nội dung ${index}`, position: { x: 0, y: 0, z: 0 } },
  createdBy: null, reviewedBy: null, reason: null, reviewedAt: null,
  createdAt: '2026-10-19T00:00:00Z',
}));

export async function installModerationApi(page: Page, { authenticated = true, permissions = ['revision:publish'] } = {}) {
  const detailRequests: string[] = [];
  const writes: string[] = [];
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'reviewer@example.test', displayName: 'Reviewer', roles: ['reviewer'], permissions };
  await page.route('**/api/**', async route => {
    const request = route.request();
    if (!new URL(request.url()).pathname.startsWith('/api/')) { await route.continue(); return; }
    const path = new URL(request.url()).pathname.replace('/api', '');
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: {
        'Access-Control-Allow-Origin': request.headers().origin ?? 'http://127.0.0.1:4173',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'authorization,content-type',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      } });
      return;
    }
    if (path === '/auth/me') {
      const hasSession = authenticated && !!request.headers().authorization;
      await fulfillMuseum(route, hasSession ? envelope(user) : { success: false, message: 'Unauthenticated', data: null }, hasSession ? 200 : 401);
      return;
    }
    if (path === '/auth/refresh') {
      await fulfillMuseum(route, authenticated ? envelope({ accessToken: 'keyboard-fixture-token' }) : { success: false, data: null, message: 'Unauthenticated' }, authenticated ? 200 : 401);
      return;
    }
    if (path === '/auth/login') { await fulfillMuseum(route, envelope({ accessToken: 'keyboard-fixture-token', user })); return; }
    if (path === '/auth/logout') { writes.push(path); await fulfillMuseum(route, envelope(null)); return; }
    if (request.method() !== 'GET') { writes.push(path); await fulfillMuseum(route, envelope({})); return; }
    if (path === '/moderation/queue') {
      const pageNumber = Number(new URL(request.url()).searchParams.get('page') ?? 1);
      await fulfillMuseum(route, { ...envelope(pageNumber === 1 ? revisions : []), meta: { page: pageNumber, pageSize: 20, total: 21 } });
      return;
    }
    const revision = revisions.find(item => path === `/moderation/revisions/${item.id}`);
    if (revision) { detailRequests.push(revision.id); await fulfillMuseum(route, envelope(revision)); return; }
    if (path.endsWith('/diff')) { await fulfillMuseum(route, envelope({ fields: [], publishedRevisionNo: null, targetRevisionNo: 1 })); return; }
    if (path.endsWith('/revisions')) { await fulfillMuseum(route, envelope([])); return; }
    await fulfillMuseum(route, envelope({}));
  });
  return { detailRequests, writes };
}
