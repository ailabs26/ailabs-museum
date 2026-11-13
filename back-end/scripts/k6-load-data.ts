/**
 * Task 29 — Chuẩn bị dữ liệu cho bài đo tải k6 (AC-49) trên Postgres LOCAL.
 *
 *   npm run migration:run && npm run seed     # schema + RBAC + admin (SEED_ADMIN_EMAIL)
 *   npm run load:k6:prepare                   # 5 hiện vật demo + K6_LOAD_ROOMS phòng nhân bản
 *
 * Chỉ chấp nhận DATABASE_URL trỏ tới localhost: script XÓA rồi tạo lại các phòng `k6-load-*`,
 * không bao giờ được chạy vào Supabase dùng chung của nhóm.
 *
 * Dữ liệu tạo ra: mỗi phòng tải là bản sao phòng demo (5 bục, 5 hiện vật APPROVED + visible,
 * kèm hotspot nếu có), tên hiện vật thêm hậu tố "· bản N" để truy vấn tìm kiếm có kết quả
 * khác nhau theo trang. Mặc định 40 phòng → 41 phòng ACTIVE, 205 hiện vật công khai.
 */
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';

/** Tiền tố slug của phòng do script tạo — dùng để dọn sạch trước mỗi lần chạy. */
export const LOAD_ROOM_SLUG_PREFIX = 'k6-load-';
const DEFAULT_LOAD_ROOMS = 40;
const MAX_LOAD_ROOMS = 500;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** Ném lỗi nếu DATABASE_URL không phải Postgres trên máy local. */
export function assertLocalDatabaseUrl(url: string | undefined): void {
  if (!url) throw new Error('Thiếu DATABASE_URL.');
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error('DATABASE_URL không hợp lệ.');
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`Từ chối chạy: DATABASE_URL trỏ tới "${host}", chỉ chấp nhận DB localhost.`);
  }
}

/** Đọc số phòng tải từ env; giá trị không hợp lệ → lỗi thay vì âm thầm dùng mặc định. */
export function parseLoadRoomCount(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_LOAD_ROOMS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_LOAD_ROOMS) {
    throw new Error(`K6_LOAD_ROOMS phải là số nguyên 1–${MAX_LOAD_ROOMS}, nhận "${raw}".`);
  }
  return value;
}

/** Slug của phòng tải thứ `index` (1-based), có đệm 0 để sắp xếp ổn định. */
export function loadRoomSlug(index: number): string {
  return `${LOAD_ROOM_SLUG_PREFIX}${String(index).padStart(3, '0')}`;
}

/** Xóa toàn bộ dữ liệu `k6-load-*` theo đúng thứ tự khóa ngoại (RESTRICT). */
async function purgeLoadRooms(manager: EntityManager): Promise<void> {
  const pattern = `${LOAD_ROOM_SLUG_PREFIX}%`;
  const exhibitsOfLoadRooms =
    'SELECT e.id FROM exhibits e JOIN rooms r ON r.id = e.room_id WHERE r.slug LIKE $1';
  await manager.query(`UPDATE exhibits SET published_revision_id = NULL WHERE id IN (${exhibitsOfLoadRooms})`, [pattern]);
  await manager.query(
    `DELETE FROM hotspots WHERE revision_id IN (SELECT id FROM exhibit_revisions WHERE exhibit_id IN (${exhibitsOfLoadRooms}))`,
    [pattern],
  );
  await manager.query(`DELETE FROM exhibit_revisions WHERE exhibit_id IN (${exhibitsOfLoadRooms})`, [pattern]);
  await manager.query(`DELETE FROM exhibits WHERE id IN (${exhibitsOfLoadRooms})`, [pattern]);
  await manager.query('DELETE FROM rooms WHERE slug LIKE $1', [pattern]);
}

/** Nhân bản phòng demo thành `count` phòng tải, mỗi phòng đủ hiện vật đã xuất bản + hotspot. */
async function cloneDemoRoom(manager: EntityManager, demoRoomId: string, count: number): Promise<number> {
  const demoExhibits: Array<{ id: string; published_revision_id: string }> = await manager.query(
    `SELECT id, published_revision_id FROM exhibits
      WHERE room_id = $1 AND is_deleted = false AND published_revision_id IS NOT NULL
      ORDER BY display_order, id`,
    [demoRoomId],
  );
  if (demoExhibits.length === 0) throw new Error('Phòng demo chưa có hiện vật đã xuất bản (chạy seed demo trước).');

  for (let index = 1; index <= count; index += 1) {
    const roomId = randomUUID();
    await manager.query(
      `INSERT INTO rooms (id, slug, name, description, status, translations)
       SELECT $1, $2, name || ' · bản ' || $3::text, description, 'active', translations FROM rooms WHERE id = $4`,
      [roomId, loadRoomSlug(index), index, demoRoomId],
    );
    for (const source of demoExhibits) {
      const exhibitId = randomUUID();
      const revisionId = randomUUID();
      await manager.query(
        `INSERT INTO exhibits (id, room_id, visibility, version, display_order)
         SELECT $1, $2, visibility, version, display_order FROM exhibits WHERE id = $3`,
        [exhibitId, roomId, source.id],
      );
      await manager.query(
        `INSERT INTO exhibit_revisions (id, exhibit_id, revision_no, state, content, model_media_id, image_media_id,
           audio_media_id, audio_en_media_id, subtitle_vi_media_id, subtitle_en_media_id, created_by, reviewed_by,
           reason, reviewed_at)
         SELECT $1, $2, revision_no, state, jsonb_set(content, '{name}', to_jsonb((content->>'name') || ' · bản ' || $3::text)),
           model_media_id, image_media_id, audio_media_id, audio_en_media_id, subtitle_vi_media_id, subtitle_en_media_id,
           created_by, reviewed_by, reason, reviewed_at
         FROM exhibit_revisions WHERE id = $4`,
        [revisionId, exhibitId, index, source.published_revision_id],
      );
      await manager.query(
        `INSERT INTO hotspots (revision_id, label, body, position_x, position_y, position_z, display_order)
         SELECT $1, label, body, position_x, position_y, position_z, display_order FROM hotspots WHERE revision_id = $2`,
        [revisionId, source.published_revision_id],
      );
      await manager.query('UPDATE exhibits SET published_revision_id = $1 WHERE id = $2', [revisionId, exhibitId]);
    }
  }
  return demoExhibits.length * count;
}

export async function prepareLoadData(source: DataSource, env: NodeJS.ProcessEnv): Promise<void> {
  const { DEMO_ROOM_SLUG } = await import('../src/database/seeds/demo-content');
  const { seedDemoContent } = await import('../src/database/seeds/seed-demo-content');
  const roomCount = parseLoadRoomCount(env.K6_LOAD_ROOMS);
  const adminEmail = env.SEED_ADMIN_EMAIL;
  if (!adminEmail) throw new Error('Thiếu SEED_ADMIN_EMAIL (admin do `npm run seed` tạo).');

  // Phòng demo là nguồn nhân bản; tạo nếu DB mới tinh rồi để seed demo điền 5 hiện vật chuẩn.
  await source.query(
    `INSERT INTO rooms (slug, name) VALUES ($1, 'Phòng Lịch sử Quân sự Việt Nam') ON CONFLICT (slug) DO NOTHING`,
    [DEMO_ROOM_SLUG],
  );
  await seedDemoContent(source, adminEmail);
  const [{ id: demoRoomId }] = await source.query('SELECT id FROM rooms WHERE slug = $1', [DEMO_ROOM_SLUG]);

  const created = await source.transaction(async (manager) => {
    await purgeLoadRooms(manager);
    return cloneDemoRoom(manager, demoRoomId, roomCount);
  });
  console.log(`Dữ liệu tải k6: ${roomCount} phòng "${LOAD_ROOM_SLUG_PREFIX}*", ${created} hiện vật đã xuất bản.`);
}

async function main(): Promise<void> {
  // Nạp .env trước khi kiểm tra (biến đặt sẵn trên dòng lệnh vẫn được ưu tiên, dotenv không ghi đè).
  (await import('dotenv')).config();
  assertLocalDatabaseUrl(process.env.DATABASE_URL);
  const { dataSource } = await import('../src/config/data-source');
  await dataSource.initialize();
  try {
    await prepareLoadData(dataSource, process.env);
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
