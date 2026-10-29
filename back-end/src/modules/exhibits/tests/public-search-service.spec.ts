import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Paginated } from '../../../common/types/paginated.type';
import { Exhibit, ExhibitVisibility } from '../entities/exhibit.entity';
import { ExhibitRevision, RevisionState } from '../entities/exhibit-revision.entity';
import { Room, RoomStatus } from '../../rooms/entities/room.entity';
import { ExhibitsService } from '../services/exhibits.service';
import { ExhibitsRepository } from '../repositories/exhibits.repository';
import { PublicSearchQueryDto } from '../dto/public-search-query.dto';
import { testMediaUrlService } from '../../media/tests/media-test-doubles';

// ============================================================================
// VT-077 — Unit test cho ExhibitsService.publicSearch (mock repository, không DB)
// Phủ: AC-1 (search), AC-3 (pagination/meta), AC-4 (giữ thứ tự ổn định),
//      AC-5 (chỉ trả bản đã publish), và failure-path (chốt mutation §E).
// ============================================================================

const ROOM_ID = 'e4b50c18-971c-4b68-b39f-f5cf171a8123';

function makeRoom(): Room {
  const room = new Room();
  room.id = ROOM_ID;
  room.slug = 'phong-gom-su';
  room.name = 'Phòng Gốm Sứ';
  room.description = null;
  room.status = RoomStatus.ACTIVE;
  room.isDeleted = false;
  return room;
}

/** Hiện vật đã xuất bản hợp lệ (mapper trả về DTO khác null). */
function approvedExhibit(id: string, displayOrder: number, name: string): Exhibit {
  const revId = `${id.slice(0, 8)}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;
  const rev = new ExhibitRevision();
  rev.id = revId;
  rev.exhibitId = id;
  rev.revisionNo = 1;
  rev.state = RevisionState.APPROVED;
  rev.content = {
    name: { vi: name, en: name },
    description: { vi: 'mô tả', en: 'desc' },
    position: { x: 0, y: 0, z: 0 },
  } as unknown as ExhibitRevision['content'];
  rev.hotspots = [];

  const ex = new Exhibit();
  ex.id = id;
  ex.roomId = ROOM_ID;
  ex.room = makeRoom();
  ex.displayOrder = displayOrder;
  ex.visibility = ExhibitVisibility.VISIBLE;
  ex.isDeleted = false;
  ex.archivedAt = null;
  ex.publishedRevisionId = revId;
  ex.publishedRevision = rev;
  return ex;
}

/** Hiện vật chưa xuất bản (draft) — mapper phải trả null → service loại khỏi kết quả. */
function draftExhibit(id: string, displayOrder: number): Exhibit {
  const ex = approvedExhibit(id, displayOrder, 'nháp');
  ex.publishedRevision!.state = RevisionState.DRAFT;
  return ex;
}

/** Repository giả chỉ lộ đúng method publicSearch; ghi lại query để assert passthrough. */
function fakeRepo(
  result: Paginated<Exhibit>,
  spy: { lastQuery?: Partial<PublicSearchQueryDto> },
): ExhibitsRepository {
  return {
    async searchPublicExhibits(query: Partial<PublicSearchQueryDto>) {
      spy.lastQuery = query;
      return result;
    },
  } as unknown as ExhibitsRepository;
}

function makeService(repo: ExhibitsRepository): ExhibitsService {
  return new ExhibitsService(
    repo,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    testMediaUrlService(),
  );
}

const QUERY = Object.assign(new PublicSearchQueryDto(), { page: 1, pageSize: 20 });

describe('VT-077 ExhibitsService.publicSearch', () => {
  it('TC-06/AC-3: trả meta (page/pageSize/total) đúng như repository', async () => {
    const repo = fakeRepo(
      { items: [approvedExhibit('11111111-1111-4111-8111-111111111111', 1, 'Bình gốm')], total: 7, page: 2, pageSize: 2 },
      {},
    );
    const result = await makeService(repo).publicSearch(
      Object.assign(new PublicSearchQueryDto(), { page: 2, pageSize: 2 }),
    );
    assert.equal(result.total, 7);
    assert.equal(result.page, 2);
    assert.equal(result.pageSize, 2);
  });

  it('TC-01/AC-1: ánh xạ sang DTO công khai, không lộ field nội bộ', async () => {
    const repo = fakeRepo(
      { items: [approvedExhibit('11111111-1111-4111-8111-111111111111', 1, 'Trống đồng')], total: 1, page: 1, pageSize: 20 },
      {},
    );
    const result = await makeService(repo).publicSearch(QUERY);
    assert.equal(result.items.length, 1);
    const item = result.items[0] as unknown as Record<string, unknown>;
    assert.equal(item.name, 'Trống đồng');
    assert.ok('revisionId' in item && 'displayOrder' in item);
    // Contract an ninh: không rò rỉ entity thô / storage key.
    assert.ok(!('publishedRevision' in item));
    assert.ok(!('storageKey' in item));
    assert.ok(!('isDeleted' in item));
  });

  it('TC-07/TC-08/AC-4: giữ NGUYÊN thứ tự repository trả (ổn định, không re-sort phá vỡ)', async () => {
    const ids = [
      '33333333-3333-4333-8333-333333333333',
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ];
    const items = ids.map((id, i) => approvedExhibit(id, 1, `item-${i}`)); // cùng displayOrder=1
    const repo = fakeRepo({ items, total: 3, page: 1, pageSize: 20 }, {});
    const result = await makeService(repo).publicSearch(QUERY);
    assert.deepEqual(
      result.items.map((x) => x.id),
      ids,
      'thứ tự đầu ra phải khớp thứ tự ổn định từ repository',
    );
  });

  it('AC-2: truyền q/roomId/page/pageSize xuống repository (không tự bịa filter)', async () => {
    const spy: { lastQuery?: Partial<PublicSearchQueryDto> } = {};
    const repo = fakeRepo({ items: [], total: 0, page: 3, pageSize: 5 }, spy);
    const query = Object.assign(new PublicSearchQueryDto(), {
      q: 'gốm',
      roomId: ROOM_ID,
      page: 3,
      pageSize: 5,
    });
    await makeService(repo).publicSearch(query);
    assert.equal(spy.lastQuery?.q, 'gốm');
    assert.equal(spy.lastQuery?.roomId, ROOM_ID);
    assert.equal(spy.lastQuery?.page, 3);
    assert.equal(spy.lastQuery?.pageSize, 5);
  });

  it('AC-5: loại hiện vật chưa xuất bản (mapper trả null) khỏi kết quả', async () => {
    const items = [
      approvedExhibit('11111111-1111-4111-8111-111111111111', 1, 'đã publish'),
      draftExhibit('22222222-2222-4222-8222-222222222222', 2),
    ];
    const repo = fakeRepo({ items, total: 2, page: 1, pageSize: 20 }, {});
    const result = await makeService(repo).publicSearch(QUERY);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].name, 'đã publish');
  });

  it('TC-12/failure-path: repository ném lỗi → service KHÔNG nuốt lỗi, phải propagate', async () => {
    const repo = {
      async searchPublicExhibits() {
        throw new Error('DB down');
      },
    } as unknown as ExhibitsRepository;
    await assert.rejects(() => makeService(repo).publicSearch(QUERY), /DB down/);
  });
});
