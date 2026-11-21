import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client';
import { ApiException, CANCELED_ERROR_CODE } from '@/core/api/api-error';
import {
  QUERY_CACHE_STORAGE_KEY,
  createPersistOptions,
  createQueryClient,
  shouldRetry,
} from './query-client';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('shouldRetry', () => {
  it('thử lại lỗi tạm thời tối đa 2 lần', () => {
    expect(shouldRetry(0, new ApiException('mất mạng', 0))).toBe(true);
    expect(shouldRetry(1, new ApiException('lỗi server', 503))).toBe(true);
    expect(shouldRetry(0, new ApiException('quá tải', 429))).toBe(true);
    expect(shouldRetry(2, new ApiException('mất mạng', 0))).toBe(false);
  });

  it('không thử lại lỗi 4xx và request bị hủy', () => {
    expect(shouldRetry(0, new ApiException('không tìm thấy', 404))).toBe(false);
    expect(shouldRetry(0, new ApiException('hết hạn', 401))).toBe(false);
    expect(shouldRetry(0, new ApiException('hủy', 0, [{ code: CANCELED_ERROR_CODE, message: 'hủy' }]))).toBe(false);
  });
});

describe('persist cache qua AsyncStorage', () => {
  // gcTime 7 ngày để lại timer; clear() hủy timer để Jest thoát được.
  const clients: QueryClient[] = [];
  const newClient = () => {
    const client = createQueryClient();
    clients.push(client);
    return client;
  };

  beforeEach(() => AsyncStorage.clear());
  afterEach(() => clients.splice(0).forEach((c) => c.clear()));

  async function saveFrom(setup: (client: QueryClient) => void, buster = 'v1') {
    const client = newClient();
    setup(client);
    await persistQueryClientSave({ queryClient: client, ...createPersistOptions(AsyncStorage, buster) });
  }

  async function restoreInto(buster = 'v1') {
    const client = newClient();
    await persistQueryClientRestore({ queryClient: client, ...createPersistOptions(AsyncStorage, buster) });
    return client;
  }

  it('dữ liệu đã tải sống qua lần khởi động lại', async () => {
    await saveFrom((c) => c.setQueryData(['rooms'], [{ slug: 'phong-1' }]));
    expect(await AsyncStorage.getItem(QUERY_CACHE_STORAGE_KEY)).not.toBeNull();

    const restored = await restoreInto();
    expect(restored.getQueryData(['rooms'])).toEqual([{ slug: 'phong-1' }]);
  });

  it('đổi phiên bản app thì bỏ cache cũ', async () => {
    await saveFrom((c) => c.setQueryData(['rooms'], [{ slug: 'phong-1' }]), 'v1');
    const restored = await restoreInto('v2');
    expect(restored.getQueryData(['rooms'])).toBeUndefined();
  });

  it('không lưu query đánh dấu persist: false', async () => {
    await saveFrom((c) => {
      c.setQueryDefaults(['auth'], { meta: { persist: false } });
      c.setQueryData(['rooms'], []);
      c.setQueryData(['auth', 'me'], { email: 'a@b.c' });
    });
    const restored = await restoreInto();
    expect(restored.getQueryData(['rooms'])).toEqual([]);
    expect(restored.getQueryData(['auth', 'me'])).toBeUndefined();
  });
});
