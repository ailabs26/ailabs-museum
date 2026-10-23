import type { Page } from '@playwright/test';

export interface TestMediaItem {
  id: string;
  kind: 'image' | 'model' | 'audio' | 'subtitle';
  url: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  processingState: 'pending' | 'ready' | 'failed' | 'quarantined';
  altText?: string | null;
  source?: string | null;
  author?: string | null;
  license?: string | null;
  createdAt: string;
}

export const initialTestMedia: TestMediaItem[] = [
  {
    id: 'media-001',
    kind: 'image',
    url: 'http://localhost:3001/media/uploads/image/sample-photo.png',
    originalName: 'anh-hien-vat-dong-son.png',
    sizeBytes: 102400,
    mimeType: 'image/png',
    processingState: 'ready',
    altText: 'Ảnh chụp cận cảnh hoa văn trống đồng',
    source: 'Bảo tàng Lịch sử Quốc gia',
    author: 'Nguyễn Văn A',
    license: 'CC BY-NC 4.0',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'media-002',
    kind: 'model',
    url: 'http://localhost:3001/media/uploads/model/sample-model.glb',
    originalName: 'trong_dong_dong_son.glb',
    sizeBytes: 1572864,
    mimeType: 'model/gltf-binary',
    processingState: 'ready',
    altText: 'Mô hình 3D trống đồng Đông Sơn',
    source: 'AILabs 3D Scanning',
    author: 'AILabs Studio',
    license: 'Proprietary',
    createdAt: new Date().toISOString(),
  },
];

export async function installCmsMediaApi(page: Page, customMedia: TestMediaItem[] = initialTestMedia) {
  let mediaList: TestMediaItem[] = [...customMedia];
  const writes: Array<{ method: string; path: string; data?: unknown }> = [];

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
          permissions: ['media:upload', 'media:read', 'media:update', 'media:delete'],
        },
        message: null,
      }),
    });
  });

  // GET & POST upload
  await page.route('**/api/admin/media*', async (route) => {
    const method = route.request().method();
    const url = new URL(route.request().url());

    if (method === 'GET') {
      const q = url.searchParams.get('q')?.toLowerCase() || '';
      let filtered = mediaList;
      if (q) {
        filtered = filtered.filter((m) => m.originalName.toLowerCase().includes(q) || (m.altText && m.altText.toLowerCase().includes(q)));
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: filtered,
          meta: { page: 1, pageSize: 15, total: filtered.length },
          message: null,
        }),
      });
      return;
    }

    if (method === 'POST' && url.pathname.endsWith('/upload')) {
      writes.push({ method: 'POST', path: '/admin/media/upload' });
      const newMedia: TestMediaItem = {
        id: `media-${Date.now()}`,
        kind: 'image',
        url: 'http://localhost:3001/media/uploads/image/uploaded.png',
        originalName: 'test-upload.png',
        sizeBytes: 2048,
        mimeType: 'image/png',
        processingState: 'ready',
        altText: 'Ảnh vừa tải lên từ kiểm thử E2E',
        source: 'Aura QA Test',
        author: 'QA Lead',
        license: 'CC0',
        createdAt: new Date().toISOString(),
      };
      mediaList.unshift(newMedia);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: newMedia, message: null }),
      });
      return;
    }

    await route.continue();
  });

  // DELETE & PATCH /api/admin/media/:id
  await page.route(/.*\/api\/admin\/media\/[^/]+$/, async (route) => {
    const method = route.request().method();
    const url = new URL(route.request().url());
    const id = url.pathname.split('/').pop()!;

    if (method === 'DELETE') {
      // Giả lập BR-21: nếu id là media-002 (đang gắn với exhibit đã publish) thì trả 409
      if (id === 'media-002') {
        writes.push({ method: 'DELETE', path: `/admin/media/${id}` });
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            data: null,
            message: 'Không thể xóa media đang được sử dụng bởi hiện vật đã xuất bản (BR-21).',
          }),
        });
        return;
      }

      writes.push({ method: 'DELETE', path: `/admin/media/${id}` });
      mediaList = mediaList.filter((m) => m.id !== id);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: null, message: 'Đã xóa file thành công' }),
      });
      return;
    }

    if (method === 'PATCH') {
      const body = route.request().postDataJSON();
      writes.push({ method: 'PATCH', path: `/admin/media/${id}`, data: body });
      const item = mediaList.find((m) => m.id === id);
      if (item) {
        Object.assign(item, body);
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: item, message: null }) });
      } else {
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Not found' }) });
      }
      return;
    }

    await route.continue();
  });

  return { getMedia: () => mediaList, writes };
}

