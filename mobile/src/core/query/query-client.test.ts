import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client';
import {
  QUERY_CACHE_STORAGE_KEY,
  createPersistOptions,
  createQueryClient,
} from './query-client';

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

  it('làm mới nền thất bại vẫn giữ dữ liệu đã tải trong cache đĩa', async () => {
    const client = newClient();
    client.setQueryData(['rooms'], [{ slug: 'phong-1' }]);
    await client
      .fetchQuery({ queryKey: ['rooms'], queryFn: () => Promise.reject(new Error('503')), staleTime: 0, retry: false })
      .catch(() => undefined);
    expect(client.getQueryState(['rooms'])?.status).toBe('error');
    await persistQueryClientSave({ queryClient: client, ...createPersistOptions(AsyncStorage, 'v1') });
    expect((await restoreInto()).getQueryData(['rooms'])).toEqual([{ slug: 'phong-1' }]);
  });
});
