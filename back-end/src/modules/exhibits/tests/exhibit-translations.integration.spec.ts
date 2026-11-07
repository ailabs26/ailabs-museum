import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { DataSource } from 'typeorm';
import { dataSource as appDataSource } from '../../../config/data-source';
import { Room } from '../../rooms/entities/room.entity';
import { User } from '../../users/entities/user.entity';
import { ExhibitRevision, RevisionState } from '../entities/exhibit-revision.entity';
import { Exhibit, ExhibitVisibility } from '../entities/exhibit.entity';
import { Hotspot } from '../entities/hotspot.entity';
import { ExhibitsRepository } from '../repositories/exhibits.repository';

/**
 * Tìm kiếm công khai theo bản dịch trên PostgreSQL THẬT. Chỉ chạy khi CORE_TEST_DATABASE_URL trỏ localhost;
 * chỉ đụng dữ liệu do test tạo.
 */
const TEST_DATABASE_URL = process.env.CORE_TEST_DATABASE_URL;
const isLocalDatabase = !!TEST_DATABASE_URL && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(TEST_DATABASE_URL);
const skip = isLocalDatabase ? false : 'Cần CORE_TEST_DATABASE_URL trỏ tới PostgreSQL cục bộ';

describe('Tìm hiện vật theo bản dịch (PostgreSQL thật)', { skip }, () => {
  let db: DataSource;
  let repo: ExhibitsRepository;
  let roomId: string;
  let userId: string;
  const tag = randomUUID().slice(0, 8);
  const exhibits: string[] = [];

  /** Hiện vật có một revision; `published` gắn revision đó làm bản đang xuất bản. */
  async function createExhibit(name: Record<string, string>, state: RevisionState, published: boolean): Promise<string> {
    const exhibit = await db.getRepository(Exhibit).save({ roomId, visibility: ExhibitVisibility.VISIBLE, version: 1 });
    exhibits.push(exhibit.id);
    const revision = await db.getRepository(ExhibitRevision).save({
      exhibitId: exhibit.id, revisionNo: 1, state, createdById: userId,
      content: { name, description: { vi: 'Mô tả' }, position: { x: 0, y: 0, z: 0 } } as never,
    });
    if (published) await db.getRepository(Exhibit).update(exhibit.id, { publishedRevisionId: revision.id });
    return exhibit.id;
  }

  before(async () => {
    db = new DataSource({ ...appDataSource.options, url: TEST_DATABASE_URL, ssl: undefined } as typeof appDataSource.options);
    await db.initialize();
    await db.runMigrations();
    repo = new ExhibitsRepository(
      db.getRepository(Exhibit) as never,
      db.getRepository(ExhibitRevision) as never,
      db.getRepository(Hotspot) as never,
    );
    const user = await db.getRepository(User).save({ email: `i18n-${tag}@example.test`, passwordHash: 'x', displayName: 'i18n' });
    userId = user.id;
    roomId = (await db.getRepository(Room).save({ slug: `i18n-${tag}`, name: 'Phòng i18n' })).id;
  });

  after(async () => {
    if (!db?.isInitialized) return;
    await db.query('UPDATE exhibits SET published_revision_id = NULL WHERE id = ANY($1)', [exhibits]);
    await db.query('DELETE FROM exhibit_revisions WHERE exhibit_id = ANY($1)', [exhibits]);
    await db.query('DELETE FROM exhibits WHERE id = ANY($1)', [exhibits]);
    await db.query('DELETE FROM rooms WHERE id = $1', [roomId]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    await db.destroy();
  });

  it('tìm được bằng tiếng Hàn và tiếng Nhật; bản dịch chưa xuất bản không lộ ra', async () => {
    const published = await createExhibit({ vi: 'Bình', ko: `꽃병${tag}`, ja: `花瓶${tag}` }, RevisionState.APPROVED, true);
    await createExhibit({ vi: 'Nháp', ko: `비밀${tag}` }, RevisionState.DRAFT, false);

    const ids = async (q: string) => (await repo.searchPublicExhibits({ q, roomId })).items.map((item) => item.id);
    assert.deepEqual(await ids(`꽃병${tag}`), [published]);
    assert.deepEqual(await ids(`花瓶${tag}`), [published]);
    assert.deepEqual(await ids(`비밀${tag}`), []);
  });

  it('tìm được theo bản dịch tên phòng', async () => {
    const published = await createExhibit({ vi: 'Tượng' }, RevisionState.APPROVED, true);
    await db.getRepository(Room).update(roomId, { translations: { name: { ko: `전시실${tag}` } } });
    const { items } = await repo.searchPublicExhibits({ q: `전시실${tag}`, roomId });
    assert.ok(items.some((item) => item.id === published));
  });
});
