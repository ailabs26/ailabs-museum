import * as FileSystem from 'expo-file-system';
import { createFileStorage } from './query-storage';

jest.mock('expo-file-system', () => jest.requireActual('../cache/file-system-mock').fileSystemMock());

const files = (FileSystem as unknown as { __files: Map<string, string> }).__files;
const DIR = 'file:///doc/q/';

describe('createFileStorage', () => {
  beforeEach(() => files.clear());

  it('ghi, đọc lại bằng instance mới, ghi đè, xóa', async () => {
    const storage = createFileStorage(DIR);
    expect(await storage.getItem('k')).toBeNull();
    await storage.setItem('k', 'v1');
    await storage.setItem('k', 'v2');
    expect(await createFileStorage(DIR).getItem('k')).toBe('v2');
    expect([...files.keys()]).toEqual([`${DIR}k.json`]);
    await storage.removeItem('k');
    expect(files.size).toBe(0);
  });

  it('tắt app khi đang ghi file tạm -> vẫn đọc bản cũ nguyên vẹn', async () => {
    files.set(`${DIR}k.json`, 'cũ');
    files.set(`${DIR}k.json.tmp`, 'mới dở d');
    expect(await createFileStorage(DIR).getItem('k')).toBe('cũ');
  });

  it('tắt app sau khi xóa bản cũ, trước khi đổi tên -> đọc file tạm đã ghi xong', async () => {
    files.set(`${DIR}k.json.tmp`, 'mới');
    expect(await createFileStorage(DIR).getItem('k')).toBe('mới');
  });

  it('xóa ngay sau khi ghi (chưa chờ) -> không bị lượt ghi dở khôi phục lại', async () => {
    const storage = createFileStorage(DIR);
    const write = storage.setItem('k', 'v');
    await storage.removeItem('k');
    await write;
    expect(files.size).toBe(0);
  });

  it('một lượt ghi lỗi (đầy đĩa) -> báo lỗi nhưng các thao tác sau vẫn chạy', async () => {
    const storage = createFileStorage(DIR);
    (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValueOnce(new Error('ENOSPC'));
    await expect(storage.setItem('k', 'v1')).rejects.toThrow('ENOSPC');
    await storage.setItem('k', 'v2');
    expect(await storage.getItem('k')).toBe('v2');
  });
});
