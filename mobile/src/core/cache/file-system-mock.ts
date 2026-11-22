/**
 * Mock `expo-file-system` bằng hệ thống file trong bộ nhớ; dùng trong `jest.mock('expo-file-system', ...)`.
 * Không import gì vì được nạp bên trong factory của `jest.mock`. `__setDownload` quyết định kết quả tải.
 */
export function fileSystemMock() {
  const files = new Map<string, string>();
  type Responder = (url: string) => { status: number; body?: string } | Error;
  let responder: Responder = () => ({ status: 200, body: 'data' });
  const downloads: string[] = [];

  return {
    __files: files,
    __downloads: downloads,
    __setDownload: (fn: Responder) => void (responder = fn),
    cacheDirectory: 'file:///cache/',
    getInfoAsync: jest.fn(async (uri: string) => {
      const body = files.get(uri);
      if (body !== undefined) return { exists: true, isDirectory: false, uri, size: body.length };
      const isDir = [...files.keys()].some((k) => k.startsWith(uri.endsWith('/') ? uri : `${uri}/`));
      return isDir ? { exists: true, isDirectory: true, uri, size: 0 } : { exists: false, isDirectory: false, uri };
    }),
    makeDirectoryAsync: jest.fn(async () => undefined),
    readAsStringAsync: jest.fn(async (uri: string) => {
      const body = files.get(uri);
      if (body === undefined) throw new Error(`ENOENT ${uri}`);
      return body;
    }),
    writeAsStringAsync: jest.fn(async (uri: string, body: string) => void files.set(uri, body)),
    deleteAsync: jest.fn(async (uri: string) => {
      for (const key of [...files.keys()]) if (key === uri || key.startsWith(uri.endsWith('/') ? uri : `${uri}/`)) files.delete(key);
    }),
    moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
      const body = files.get(from);
      if (body === undefined) throw new Error(`ENOENT ${from}`);
      files.delete(from);
      files.set(to, body);
    }),
    downloadAsync: jest.fn(async (url: string, uri: string) => {
      downloads.push(url);
      // Nhường event loop như tải thật, để kiểm được các lời gọi chạy song song.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const reply = responder(url);
      if (reply instanceof Error) throw reply;
      files.set(uri, reply.body ?? '');
      return { uri, status: reply.status, headers: {}, mimeType: null };
    }),
  };
}
