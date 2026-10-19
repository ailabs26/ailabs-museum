import { config } from 'dotenv';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { MediaStorageService } from '../../modules/media/services/media-storage.service';
import { DEFAULT_MEDIA_STORAGE_ROOTS } from '../../modules/media/storage/local-storage.driver';
import { SupabaseStorageDriver } from '../../modules/media/storage/supabase-storage.driver';

config();

/**
 * Chạy 1 lần khi chuyển sang Supabase: đẩy file media đang nằm trên đĩa
 * (`public/media/uploads`, `storage/quarantine`) lên bucket, giữ nguyên storage key nên
 * không phải sửa bảng `media`. File đã có trên bucket thì bỏ qua — chạy lại an toàn.
 */
async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const nested = await Promise.all(
    entries.map((entry) => (entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)])),
  );
  return nested.flat();
}

async function main(): Promise<void> {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env');
  }
  const storage = new MediaStorageService(
    new SupabaseStorageDriver({
      url: SUPABASE_URL.replace(/\/+$/, ''),
      serviceKey: SUPABASE_SERVICE_ROLE_KEY,
      bucket: SUPABASE_STORAGE_BUCKET ?? 'aura-media',
    }),
  );

  const { publicRoot, quarantineRoot } = DEFAULT_MEDIA_STORAGE_ROOTS;
  const files = [
    ...(await listFiles(join(publicRoot, 'uploads'))).map((path) => ({ path, key: relative(publicRoot, path) })),
    ...(await listFiles(quarantineRoot)).map((path) => ({ path, key: `quarantine/${relative(quarantineRoot, path)}` })),
  ];

  const counts = { uploaded: 0, skipped: 0, failed: 0 };
  for (const { path, key } of files) {
    const storageKey = key.split(sep).join('/');
    try {
      await storage.save(storageKey, await readFile(path));
      counts.uploaded++;
      console.log(`↑ ${storageKey}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        counts.skipped++;
        continue;
      }
      counts.failed++;
      console.error(`✗ ${storageKey}: ${(error as Error).message}`);
    }
  }
  console.log(`Xong: ${counts.uploaded} file đã đẩy, ${counts.skipped} đã có sẵn, ${counts.failed} lỗi.`);
  if (counts.failed) process.exitCode = 1;
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
