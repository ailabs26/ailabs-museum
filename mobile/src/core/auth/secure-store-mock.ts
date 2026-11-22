/**
 * Mock `expo-secure-store` bằng Map trong bộ nhớ; dùng trong `jest.mock('expo-secure-store', ...)`.
 * Không import gì vì được nạp bên trong factory của `jest.mock`, trước mọi module khác.
 */
export function secureStoreMock() {
  const data = new Map<string, string>();
  return {
    __data: data,
    getItemAsync: jest.fn(async (key: string) => data.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => void data.set(key, value)),
    deleteItemAsync: jest.fn(async (key: string) => void data.delete(key)),
  };
}
