import { QueryClientProvider, onlineManager, type QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';
import { renderRouter } from 'expo-router/testing-library';
import { fileCache } from '@/core/cache/file-cache';
import { createQueryClient } from '@/core/query/query-client';
import { ExpoFileSystemGlbCache } from '@/features/scene3d/glbCache';
import { StorageSettings } from './StorageSettings';
import { formatBytes } from './storage-usage';

jest.mock('expo-file-system', () => ({
  ...jest.requireActual('@/core/cache/file-system-mock').fileSystemMock(),
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
}));
jest.mock('expo-image', () => ({
  Image: { clearMemoryCache: jest.fn(async () => true), clearDiskCache: jest.fn(async () => true) },
}));

const fs = FileSystem as unknown as {
  __files: Map<string, string>;
  __setDownload: (fn: () => { status: number; body: string }) => void;
};
let client: QueryClient;

async function open() {
  renderRouter({
    index: () => (
      <QueryClientProvider client={client}>
        <StorageSettings />
      </QueryClientProvider>
    ),
  });
  jest.useRealTimers(); // renderRouter bật fake timers
  await waitFor(() => expect(screen.getByText('4.0 MB')).toBeTruthy());
}
const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

describe('StorageSettings', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    fs.__files.clear();
    fs.__setDownload(() => ({ status: 200, body: 'x'.repeat(1024 * 1024) }));
    await fileCache.getOrDownload('https://cdn/a.glb', { kind: 'glb', key: 'a' });
    await fileCache.getOrDownload('https://cdn/a.mp3', { kind: 'audio', key: 'a' });
    // Model thật đang nằm trong cache riêng của scene3d: phải được cộng vào.
    await new ExpoFileSystemGlbCache().putBuffer('a'.repeat(64), new ArrayBuffer(3 * 1024 * 1024));
    client = createQueryClient();
    client.setQueryData(['rooms', 'list'], []);
    client.setQueryData(['session', 'me'], { id: 'u' });
  });
  afterEach(() => {
    act(() => onlineManager.setOnline(true));
    jest.restoreAllMocks();
    client.clear();
  });

  it('cộng model của fileCache và glbCache; không đếm dữ liệu riêng của người dùng', async () => {
    await open();
    expect(screen.getByText('1.0 MB')).toBeTruthy();
    expect(screen.getByText('1 mục')).toBeTruthy();
  });

  it('cache khôi phục xong sau khi màn đã mở -> số mục cập nhật theo', async () => {
    await open();
    await act(async () => {
      client.setQueryData(['rooms', 'detail', 'a'], {});
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(screen.getByText('2 mục')).toBeTruthy();
  });

  it('phải xác nhận mới xóa; Hủy thì giữ nguyên', async () => {
    await open();
    press('Xóa Mô hình 3D');
    press('Hủy xóa Mô hình 3D');
    expect((await fileCache.getUsage()).glb.count).toBe(1);

    press('Xóa Mô hình 3D');
    press('Xác nhận xóa Mô hình 3D');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Đã xóa mô hình 3d.'));
    expect(screen.getByText('0 B')).toBeTruthy();
    expect(await fileCache.getUsage()).toMatchObject({ glb: { count: 0 }, audio: { count: 1 } });
    expect((await new ExpoFileSystemGlbCache().getStats()).entryCount).toBe(0);
  });

  it('xóa tất cả khi offline: không treo, giữ dữ liệu phiên đăng nhập', async () => {
    await open();
    act(() => onlineManager.setOnline(false));
    press('Xóa tất cả');
    press('Xác nhận xóa tất cả');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Đã xóa tất cả.'));
    expect(screen.getByText('0 mục')).toBeTruthy();
    expect(client.getQueryData(['session', 'me'])).toEqual({ id: 'u' });
    expect(Image.clearDiskCache).toHaveBeenCalledTimes(1);
    expect((await fileCache.list()).length).toBe(0);
  });

  it('một loại lỗi -> báo đúng loại đó, các loại khác vẫn được xóa', async () => {
    await open();
    (Image.clearDiskCache as jest.Mock).mockRejectedValueOnce(new Error('disk'));
    press('Xóa tất cả');
    press('Xác nhận xóa tất cả');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Không xóa được: Hình ảnh.'));
    expect((await fileCache.list()).length).toBe(0);
  });

  it('formatBytes', () => {
    expect([0, 1023, 2048, 5 * 1024 * 1024].map(formatBytes)).toEqual(['0 B', '1023 B', '2 KB', '5.0 MB']);
  });
});
