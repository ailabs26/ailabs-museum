import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

/**
 * Nơi lưu cache react-query (MOB-E3-02). Cả cache là một chuỗi JSON: AsyncStorage trên Android giới hạn
 * tổng dung lượng và cỡ mỗi dòng (CursorWindow), catalogue nhiều phòng có thể vượt → native lưu bằng file.
 * Web (chỉ dùng khi dev) không có file system → AsyncStorage (localStorage).
 */
export interface QueryStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Ghi file tạm rồi đổi tên; tắt app giữa chừng thì còn nguyên bản cũ hoặc bản mới. */
export function createFileStorage(dir: string): QueryStorage {
  const path = (key: string) => `${dir}${key}.json`;
  const tmpPath = (key: string) => `${path(key)}.tmp`;
  const exists = async (uri: string) => (await FileSystem.getInfoAsync(uri)).exists;
  // Ghi/xóa tuần tự: xóa cache không bị một lượt ghi đang chạy dở khôi phục lại.
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(work: () => Promise<T>): Promise<T> => {
    const run = queue.then(work);
    queue = run.catch(() => undefined);
    return run;
  };

  return {
    getItem: (key) =>
      enqueue(async () => {
        // Bản chính chỉ vắng khi app tắt giữa lúc xóa bản cũ và đổi tên: lúc đó file tạm đã ghi xong.
        for (const uri of [path(key), tmpPath(key)]) {
          if (await exists(uri)) return FileSystem.readAsStringAsync(uri);
        }
        return null;
      }),
    setItem: (key, value) =>
      enqueue(async () => {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        await FileSystem.writeAsStringAsync(tmpPath(key), value);
        await FileSystem.deleteAsync(path(key), { idempotent: true });
        await FileSystem.moveAsync({ from: tmpPath(key), to: path(key) });
      }),
    removeItem: (key) =>
      enqueue(async () => {
        await FileSystem.deleteAsync(path(key), { idempotent: true });
        await FileSystem.deleteAsync(tmpPath(key), { idempotent: true });
      }),
  };
}

/** documentDirectory: khác cacheDirectory, hệ điều hành không tự dọn nên nội dung offline không biến mất. */
export const queryStorage: QueryStorage = FileSystem.documentDirectory
  ? createFileStorage(`${FileSystem.documentDirectory}aura-query-cache/`)
  : AsyncStorage;
