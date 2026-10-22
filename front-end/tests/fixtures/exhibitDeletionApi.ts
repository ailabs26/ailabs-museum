import type { Page } from '@playwright/test';
import { installOverlayApi } from './overlayApi';
import { editDetail } from './exhibitEditApi';
import { fulfillMuseum } from './museumApi';
import { envelope, exhibit } from './museumContent';

export async function installExhibitDeletionApi(page: Page, permissions = ['exhibit:read', 'exhibit:update', 'revision:hide']) {
  await installOverlayApi(page, permissions);
  const state = { records: [editDetail(1)], writes: [] as { method: string; path: string; body: unknown }[],
    deleteStatus: 200, hideStatus: 200, detailGate: undefined as Promise<void> | undefined,
    mutationGate: undefined as Promise<void> | undefined, pageGets: [] as number[],
    media: [{ id: 'preserved-media', originalName: 'shared-image.fixture' }] };
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url());
    if (!url.pathname.startsWith('/api/') || req.method() === 'OPTIONS' || url.pathname.startsWith('/api/auth/')) { await route.fallback(); return; }
    const path = url.pathname.slice(4);
    if (req.method() === 'GET' && path === '/rooms/fixture') {
      await fulfillMuseum(route, envelope({ id: state.records[0]?.roomId, slug: 'fixture', name: 'Phòng mẫu',
        exhibits: state.records.filter(item => item.visibility === 'visible' && item.publishedRevisionId)
          .map((item, index) => ({ ...exhibit(index + 1, item.roomId), id: item.id })) })); return;
    }
    if (req.method() === 'GET' && path === '/admin/media') {
      await fulfillMuseum(route, { ...envelope(state.media), meta: { page: 1, pageSize: 100, total: state.media.length } }); return;
    }
    if (path === '/admin/exhibits') {
      const currentPage = Number(url.searchParams.get('page') ?? 1);
      state.pageGets.push(currentPage);
      const size = 15;
      await fulfillMuseum(route, { ...envelope(state.records.slice((currentPage - 1) * size, currentPage * size)), meta: { page: currentPage, pageSize: size, total: state.records.length } }); return;
    }
    const record = state.records.find(item => path.includes(item.id));
    if (record && (path.startsWith('/admin/exhibits/') || path.endsWith('/hide'))) {
      if (req.method() === 'GET') {
        const snapshot = structuredClone(record);
        if (state.detailGate) await state.detailGate;
        await fulfillMuseum(route, envelope(snapshot)); return;
      }
      state.writes.push({ method: req.method(), path, body: req.postDataJSON() });
      if (state.mutationGate) await state.mutationGate;
      if (req.method() === 'DELETE') {
        if (state.deleteStatus !== 200) { await fulfillMuseum(route, { success: false, data: null, message: 'Hiện vật có báo cáo liên quan nên không thể xóa vĩnh viễn.' }, state.deleteStatus); return; }
        state.records.splice(state.records.indexOf(record), 1);
        await fulfillMuseum(route, envelope({ success: true, message: 'Đã xóa' })); return;
      }
      if (path.endsWith('/hide')) {
        if (state.hideStatus !== 200) { await fulfillMuseum(route, { success: false, data: null, message: 'Trạng thái hiện vật vừa thay đổi. Vui lòng tải lại.' }, state.hideStatus); return; }
        record.visibility = 'hidden'; record.status = 'draft'; record.version++;
        await fulfillMuseum(route, envelope({ id: record.id, version: record.version, visibility: record.visibility, publishedRevisionId: record.publishedRevisionId, roomId: record.roomId })); return;
      }
    }
    if (req.method() !== 'GET') throw new Error(`Unexpected write ${path}`);
    if (path === '/admin/rooms' || path === '/admin/media') { await route.fallback(); return; }
    await fulfillMuseum(route, envelope([]));
  });
  return state;
}
