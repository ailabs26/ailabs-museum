import type { Page } from '@playwright/test';
import type { Revision } from '../../src/services/moderation.service';
import { installExhibitEditApi } from './exhibitEditApi';
import { fulfillMuseum } from './museumApi';
import { envelope } from './museumContent';

export function queueRevision(index = 1): Revision {
  return { id: `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`, exhibitId: '10000000-0000-4000-8000-000000000001',
    revisionNo: index, state: 'in_review', content: { name: 'Bình gốm', description: 'Mô tả', position: { x: 0, y: 0, z: 0 } },
    createdBy: null, reviewedBy: null, reason: null, createdAt: '2026-10-20T00:00:00Z', reviewedAt: null };
}

export async function installModerationQueueApi(page: Page) {
  const exhibits = await installExhibitEditApi(page);
  const state = { exhibits, revisions: [] as Revision[], queueGets: [] as number[], status: 200, submitStatus: 200,
    gate: undefined as Promise<void> | undefined, writes: [] as string[] };
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/') || request.method() === 'OPTIONS') { await route.fallback(); return; }
    const path = url.pathname.slice(4);
    if (path.endsWith('/submit-review')) {
      state.writes.push(path);
      if (state.submitStatus !== 200) {
        await fulfillMuseum(route, { success: false, data: null, message: 'Không gửi được bản nháp', errors: state.submitStatus === 422 ? [{ field: 'altText.vi', code: 'required', message: 'Cần alt text' }] : [] }, state.submitStatus); return;
      }
      const record = exhibits.records.find(item => path.includes(item.id))!;
      record.revisionState = 'in_review';
      state.revisions.push({ ...queueRevision(state.revisions.length + 1), exhibitId: record.id, content: record.content as Revision['content'] });
      await fulfillMuseum(route, envelope(record)); return;
    }
    if (path === '/moderation/queue') {
      const pageNumber = Number(url.searchParams.get('page') ?? 1);
      state.queueGets.push(pageNumber);
      if (state.gate) await state.gate;
      if (state.status !== 200) { await fulfillMuseum(route, { success: false, data: null, message: 'Không tải được hàng chờ mẫu' }, state.status); return; }
      const pageSize = Number(url.searchParams.get('pageSize') ?? 20);
      await fulfillMuseum(route, { ...envelope(state.revisions.slice((pageNumber - 1) * pageSize, pageNumber * pageSize)), meta: { page: pageNumber, pageSize, total: state.revisions.length } }); return;
    }
    if (path.startsWith('/moderation/revisions/')) {
      const revision = state.revisions.find(item => path.includes(item.id));
      await fulfillMuseum(route, envelope(path.endsWith('/diff') ? { fields: [], targetRevisionNo: revision?.revisionNo, publishedRevisionNo: null } : revision)); return;
    }
    if (/^\/exhibits\/[^/]+\/revisions$/.test(path)) { await fulfillMuseum(route, envelope([])); return; }
    if (!path.startsWith('/auth/') && request.method() !== 'GET') throw new Error(`Unexpected mutation: ${path}`);
    await route.fallback();
  });
  return state;
}
