import { QueryClientProvider, onlineManager, type QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { createHash } from 'node:crypto';
import * as FileSystem from 'expo-file-system';
import { createQueryClient } from '@/core/query/query-client';
import { roomKeys } from '@/features/catalogue/room-queries';
import { ExpoFileSystemGlbCache } from '@/features/scene3d/glbCache';
import { GlbLoadError, loadGlbModel, type LoadGlbOptions } from '@/features/scene3d/glbLoader';
import type { PublicRoomPayload } from '@/features/scene3d/museumTypes';
import { publicRoomApi } from '@/features/scene3d/publicRoomApi';
import { OfflineRoomControl } from './OfflineRoomButton';
import { isRoomAvailableOffline, prefetchRoom, roomModels } from './room-prefetch';

jest.mock('expo-file-system', () => {
  const mock = jest.requireActual('@/core/cache/file-system-mock').fileSystemMock();
  // File base64: kích thước thật là số byte sau giải mã, như trên máy.
  const info = mock.getInfoAsync;
  mock.getInfoAsync = jest.fn(async (uri: string) => {
    const result = await info(uri);
    return uri.endsWith('.glb') && result.exists ? { ...result, size: Buffer.from(mock.__files.get(uri), 'base64').length } : result;
  });
  return { ...mock, EncodingType: { UTF8: 'utf8', Base64: 'base64' } };
});

const files = (FileSystem as unknown as { __files: Map<string, string> }).__files;

/** GLB hợp lệ nhỏ nhất: một tam giác, nội dung khác nhau theo `seed`. */
function glb(seed: number): Buffer {
  const bin = Buffer.alloc(36);
  [0, 0, 0, 1, 0, 0, 0, 1 + seed, 0].forEach((v, i) => bin.writeFloatLE(v, i * 4));
  let json = JSON.stringify({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1 + seed, 0] }],
    bufferViews: [{ buffer: 0, byteLength: 36 }],
    buffers: [{ byteLength: 36 }],
  });
  json += ' '.repeat((4 - (json.length % 4)) % 4);
  const head = Buffer.alloc(20);
  head.write('glTF');
  [2, 28 + json.length + 36, json.length, 0x4e4f534a].forEach((v, i) => head.writeUInt32LE(v, 4 + i * 4));
  const binHead = Buffer.alloc(8);
  binHead.writeUInt32LE(36, 0);
  binHead.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, Buffer.from(json), binHead, bin]);
}

const A = glb(0);
const B = glb(1);
const uuid = (n: number) => `10000000-0000-4000-8000-00000000000${n}`;
const model = (data: Buffer, n: number) => {
  const checksumSha256 = createHash('sha256').update(data).digest('hex');
  return { id: uuid(n), storageKey: `m/${n}.glb`, sizeBytes: data.length, checksumSha256, url: `/rooms/phong/exhibits/${uuid(n)}/model?version=${checksumSha256}` };
};
const M1 = model(A, 1);
const M2 = model(B, 2);
// Hiện vật 3 dùng lại model 1; hiện vật 4 không có model.
const ROOM = { id: uuid(9), slug: 'phong', name: 'Phòng', description: null, exhibits: [{ model: M1 }, { model: M2 }, { model: M1 }, {}] } as unknown as PublicRoomPayload;

const bytes = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) as ArrayBuffer;
const sha256Impl = async (b: ArrayBuffer) => createHash('sha256').update(Buffer.from(b)).digest('hex');

let client: QueryClient;
let serve: (url: string) => { status?: number; body?: Buffer };
let requests: string[];
let cache: ExpoFileSystemGlbCache;
/** loadGlbModel thật, chỉ thay mạng và hàm băm. */
const load = (options: LoadGlbOptions) =>
  loadGlbModel({
    ...options,
    apiBaseUrl: 'https://api.test/api',
    sha256Impl,
    fetchImpl: (async (url: string) => {
      requests.push(url);
      const { status = 200, body } = serve(url);
      return { ok: status < 400, status, headers: { get: () => null }, arrayBuffer: async () => bytes(body ?? A) };
    }) as unknown as typeof fetch,
  });
const run = (signal = new AbortController().signal, onProgress = jest.fn()) => prefetchRoom(client, 'phong', signal, onProgress, { cache, load });

beforeEach(() => {
  files.clear();
  requests = [];
  serve = (url) => ({ body: url.includes(M1.checksumSha256) ? A : B });
  cache = new ExpoFileSystemGlbCache();
  client = createQueryClient();
  jest.spyOn(publicRoomApi, 'detail').mockResolvedValue(ROOM);
});
afterEach(() => {
  act(() => onlineManager.setOnline(true));
  act(() => client.clear());
  jest.restoreAllMocks();
});

describe('prefetchRoom', () => {
  it('tải nội dung + mỗi model một lần; màn 3D đọc được từ cache khi mất mạng', async () => {
    const onProgress = jest.fn();
    await expect(run(undefined, onProgress)).resolves.toEqual({ total: 2, failed: 0, message: null });
    expect(onProgress.mock.calls).toEqual([[0, 2], [1, 2], [2, 2]]);
    expect(requests).toHaveLength(2);
    expect(client.getQueryData(roomKeys.detail('phong'))).toEqual(ROOM);
    expect(await isRoomAvailableOffline(ROOM, cache)).toBe(true);

    serve = () => {
      throw new Error('mất mạng');
    };
    await expect(load({ model: M1, cache })).resolves.toMatchObject({ source: 'cache' });
  });

  it('gọi lại không tải lại model đã có', async () => {
    await run();
    await run();
    expect(requests).toHaveLength(2);
  });

  it('một model lỗi -> các model khác vẫn tải; lần sau chỉ tải phần thiếu', async () => {
    serve = (url) => (url.includes(M1.checksumSha256) ? { status: 503 } : { body: B });
    await expect(run()).resolves.toMatchObject({ total: 2, failed: 1, message: 'Máy chủ gặp lỗi khi trả mô hình 3D.' });
    expect(await isRoomAvailableOffline(ROOM, cache)).toBe(false);
    serve = () => ({ body: A });
    await expect(run()).resolves.toMatchObject({ failed: 0 });
    expect(requests).toHaveLength(3);
  });

  it('nội dung sai mã băm -> không lưu', async () => {
    const bad = Buffer.from(A);
    bad[bad.length - 1] = 7;
    serve = (url) => ({ body: url.includes(M1.checksumSha256) ? bad : B });
    await expect(run()).resolves.toMatchObject({ failed: 1 });
    expect(await cache.has(M1.checksumSha256, M1.sizeBytes)).toBe(false);
  });

  it('đầy đĩa -> báo lỗi, không coi là đã tải', async () => {
    jest.spyOn(cache, 'putBuffer').mockRejectedValue(new Error('ENOSPC'));
    await expect(run()).resolves.toMatchObject({ failed: 2, message: expect.stringContaining('dung lượng trống') });
  });

  it('file ghi dở (sai kích thước) không được coi là đã có, và được tải lại', async () => {
    await run();
    const path = [...files.keys()].find((k) => k.includes(M1.checksumSha256)) as string;
    files.set(path, 'AAAA');
    expect(await isRoomAvailableOffline(ROOM, cache)).toBe(false);
    await run();
    expect(await isRoomAvailableOffline(ROOM, cache)).toBe(true);
  });

  it('phòng vượt hạn mức cache -> từ chối trước khi tải model nào', async () => {
    cache = new ExpoFileSystemGlbCache({ maxBytes: 1024 });
    const big = { ...ROOM, exhibits: [{ model: { ...M1, sizeBytes: 5000 } }] } as unknown as PublicRoomPayload;
    (publicRoomApi.detail as jest.Mock).mockResolvedValue(big);
    await expect(run()).rejects.toThrow(/vượt bộ nhớ đệm/);
    expect(requests).toEqual([]);
  });

  it('hủy giữa chừng -> AbortError, không tải tiếp; phòng chờ sau vẫn chạy', async () => {
    const controller = new AbortController();
    const first = run(controller.signal, jest.fn((done: number) => void (done === 1 && controller.abort())));
    const second = run();
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await expect(second).resolves.toMatchObject({ failed: 0 });
  });

  it('mất mạng giữa chừng -> đếm đủ model lỗi', async () => {
    const failing = async () => {
      throw new GlbLoadError('download', 'network', 'Không thể kết nối mạng để tải mô hình 3D.');
    };
    await expect(
      prefetchRoom(client, 'phong', new AbortController().signal, jest.fn(), { cache, load: failing }),
    ).resolves.toMatchObject({ failed: 2 });
  });

  it('roomModels bỏ trùng và bỏ hiện vật không có model', () => {
    expect(roomModels(ROOM)).toEqual([M1, M2]);
  });
});

describe('OfflineRoomControl', () => {
  const open = () =>
    render(
      <QueryClientProvider client={client}>
        <OfflineRoomControl slug="phong" name="Phòng" />
      </QueryClientProvider>,
    );

  it('đã có đủ file -> hiện "Đã tải"; file bị dọn -> quay lại nút tải', async () => {
    await run();
    const view = open();
    await waitFor(() => expect(screen.getByText('Đã tải để xem offline')).toBeTruthy());
    view.unmount();
    for (const key of [...files.keys()]) if (key.endsWith('.glb')) files.delete(key);
    open();
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(screen.getByText('Tải để xem offline')).toBeTruthy();
  });

  it('offline và chưa tải -> nút bị khóa', () => {
    act(() => onlineManager.setOnline(false));
    open();
    expect(screen.getByRole('button', { name: 'Tải Phòng để xem offline' })).toBeDisabled();
  });

  it('lỗi tải -> hiện lý do và cho thử lại; bấm tải có thể hủy', async () => {
    (publicRoomApi.detail as jest.Mock).mockRejectedValueOnce(new Error('API trả lỗi 503.'));
    open();
    fireEvent.press(screen.getByRole('button', { name: 'Tải Phòng để xem offline' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('API trả lỗi 503.'));

    (publicRoomApi.detail as jest.Mock).mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(ROOM), 20)));
    fireEvent.press(screen.getByRole('button', { name: 'Tải Phòng để xem offline' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Hủy tải Phòng' }));
    await act(() => new Promise((resolve) => setTimeout(resolve, 60)));
    expect(screen.getByText('Tải để xem offline')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
