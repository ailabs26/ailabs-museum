import type { Page, Route } from '@playwright/test';
import type { ExhibitDetail, ExhibitRow, UpdateExhibitInput } from '../../src/services/exhibits.service';
import { installOverlayApi, overlayExhibit } from './overlayApi';
import { fulfillMuseum } from './museumApi';
import { envelope } from './museumContent';

export function deferred() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

export function editDetail(index = 1): ExhibitDetail {
  return structuredClone({ ...overlayExhibit,
    id: `10000000-0000-4000-8000-00000000000${index}`,
    content: { ...overlayExhibit.content, name: { vi: `Hiện vật ${index}` }, description: { vi: `Mô tả ${index}` },
      imageId: null, audioViId: null, audioEnId: null, subtitleViId: null, subtitleEnId: null, modelId: null,
      altText: null, transcript: null },
  } as ExhibitDetail);
}

export async function installExhibitEditApi(page: Page) {
  await installOverlayApi(page);
  const records = [editDetail(1), editDetail(2)];
  const state = {
    records,
    listRows: null as ExhibitRow[] | null,
    patches: [] as { id: string; body: UpdateExhibitInput }[],
    requests: [] as string[],
    detailCount: 0,
    listCount: 0,
    detailHook: undefined as undefined | ((route: Route, record: ExhibitDetail, count: number) => Promise<void>),
    listHook: undefined as undefined | ((route: Route, rows: ExhibitRow[]) => Promise<void>),
    submitError: false,
  };
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/') || request.method() === 'OPTIONS') { await route.fallback(); return; }
    const path = url.pathname.slice(4);
    if (!path.startsWith('/admin/exhibits') && path !== '/admin/media') { await route.fallback(); return; }
    state.requests.push(`${request.method()} ${path}`);
    if (path === '/admin/media') {
      const kind = url.searchParams.get('kind');
      const items = [1, 2].map(index => ({ id: `90000000-0000-4000-8000-${kind === 'image' ? '00000000000' : '00000000001'}${index}`,
        kind, originalName: `${kind}-${index}.fixture`, processingState: 'ready', sizeBytes: 100,
        source: 'Fixture', author: 'Fixture', license: 'CC0', url: null }));
      await fulfillMuseum(route, { ...envelope(items), meta: { page: 1, pageSize: 100, total: 2 } }); return;
    }
    if (path === '/admin/exhibits' && request.method() === 'GET') {
      state.listCount++;
      const q = url.searchParams.get('q') ?? '';
      const rows = structuredClone(state.listRows ?? records).filter(row => !q || JSON.stringify(row.content.name).includes(q));
      if (state.listHook) { await state.listHook(route, rows); return; }
      await fulfillMuseum(route, { ...envelope(rows), meta: { page: Number(url.searchParams.get('page') ?? 1), pageSize: 15, total: rows.length } }); return;
    }
    const record = records.find(item => path.startsWith(`/admin/exhibits/${item.id}`));
    if (!record) throw new Error(`Unexpected fixture request ${request.method()} ${path}`);
    if (path.endsWith('/submit-review')) {
      await fulfillMuseum(route, state.submitError ? { success: false, data: null, message: 'Thiếu alt text', errors: [{ field: 'altText.vi', code: 'required', message: 'Cần alt text tiếng Việt' }] } : envelope(record), state.submitError ? 422 : 200); return;
    }
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON() as UpdateExhibitInput;
      state.patches.push({ id: record.id, body });
      const { hotspots, roomId, displayOrder, ...content } = body;
      record.content = { ...record.content, ...content };
      if (roomId) record.roomId = roomId;
      if (displayOrder !== undefined) record.displayOrder = displayOrder;
      if (hotspots) record.hotspots = hotspots.map((item, index) => ({ ...item, id: `${record.id}-${index}`, label: JSON.stringify(item.label), body: JSON.stringify(item.body), position: { x: item.positionX, y: item.positionY, z: item.positionZ } }));
      record.version++;
      // PATCH returns a row, never a full detail/cache substitute.
      const { hotspots: _hotspots, revisions: _revisions, room: _room, media: _media, ...row } = record;
      void _hotspots; void _revisions; void _room; void _media;
      await fulfillMuseum(route, envelope(row)); return;
    }
    state.detailCount++;
    if (state.detailHook) { await state.detailHook(route, structuredClone(record), state.detailCount); return; }
    await fulfillMuseum(route, envelope(record));
  });
  return state;
}
