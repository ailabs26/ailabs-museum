import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ExhibitsRepository } from '../repositories/exhibits.repository';
import { Exhibit } from '../entities/exhibit.entity';
import { PublicSearchQueryDto } from '../dto/public-search-query.dto';

// ============================================================================
// VT-077 — Unit test cho ExhibitsRepository.searchPublicExhibits (fake QueryBuilder)
// Chứng minh INVARIANT thứ tự ổn định (tiebreaker id), bộ lọc published/visible,
// và phân trang skip/take — không cần Postgres. Giới hạn: không thay cho integration
// DB thật (SQL/collation thực tế) — nêu rõ trong báo cáo.
// ============================================================================

interface QbCalls {
  joins: string[];
  conditions: string[];
  params: Record<string, unknown>;
  orderBy?: [string, string];
  addOrderBy?: [string, string];
  skip?: number;
  take?: number;
}

function fakeQueryBuilder(idRows: Array<{ id: string }>, total: number, calls: QbCalls) {
  const qb: Record<string, unknown> = {};
  const self = () => qb as never;
  Object.assign(qb, {
    leftJoin: (_a: string, alias: string) => (calls.joins.push(alias), self()),
    leftJoinAndSelect: (_a: string, alias: string) => (calls.joins.push(alias), self()),
    select: () => self(),
    where: (c: unknown, p?: Record<string, unknown>) => {
      calls.conditions.push(typeof c === 'string' ? c : '[brackets]');
      Object.assign(calls.params, p ?? {});
      return self();
    },
    andWhere: (c: unknown, p?: Record<string, unknown>) => {
      calls.conditions.push(typeof c === 'string' ? c : '[brackets]');
      Object.assign(calls.params, p ?? {});
      return self();
    },
    orderBy: (f: string, d: string) => ((calls.orderBy = [f, d]), self()),
    addOrderBy: (f: string, d: string) => ((calls.addOrderBy = [f, d]), self()),
    skip: (n: number) => ((calls.skip = n), self()),
    take: (n: number) => ((calls.take = n), self()),
    getManyAndCount: async () => [idRows, total] as [Exhibit[], number],
  });
  return qb;
}

/** Repo giả: QueryBuilder ghi lại lời gọi; find trả entity theo thứ tự ĐẢO để kiểm việc sắp lại. */
function makeRepo(idRows: Array<{ id: string }>, total: number, calls: QbCalls): ExhibitsRepository {
  const fakeRepo = {
    createQueryBuilder: () => fakeQueryBuilder(idRows, total, calls),
    // find trả theo thứ tự ngược với qb để chứng minh repository sắp lại theo id của qb.
    find: async () =>
      [...idRows].reverse().map((r) => Object.assign(new Exhibit(), { id: r.id })),
  };
  return new ExhibitsRepository(fakeRepo as never, {} as never, {} as never);
}

describe('VT-077 ExhibitsRepository.searchPublicExhibits', () => {
  it('AC-4 (invariant): sắp xếp displayOrder ASC + addOrderBy id ASC (tiebreaker duy nhất)', async () => {
    const calls: QbCalls = { joins: [], conditions: [], params: {} };
    await makeRepo([], 0, calls).searchPublicExhibits({});
    assert.deepEqual(calls.orderBy, ['exhibit.displayOrder', 'ASC']);
    assert.deepEqual(calls.addOrderBy, ['exhibit.id', 'ASC'], 'thiếu tiebreaker id → phân trang không ổn định');
  });

  it('AC-5/AC-1: chỉ lấy bản published + visible, chưa xóa/lưu trữ', async () => {
    const calls: QbCalls = { joins: [], conditions: [], params: {} };
    await makeRepo([], 0, calls).searchPublicExhibits({});
    const sql = calls.conditions.join(' ; ');
    assert.match(sql, /isDeleted/);
    assert.match(sql, /visibility/);
    assert.match(sql, /archivedAt IS NULL/);
    assert.match(sql, /publishedRevisionId IS NOT NULL/);
    assert.match(sql, /publishedRevision\.state/);
    assert.equal(calls.params.visibility, 'visible');
    assert.equal(calls.params.state, 'approved');
    assert.equal(calls.params.isDeleted, false);
  });

  it('AC-3: phân trang skip=(page-1)*pageSize, take=pageSize; chặn pageSize>100', async () => {
    const calls: QbCalls = { joins: [], conditions: [], params: {} };
    await makeRepo([], 0, calls).searchPublicExhibits({ page: 3, pageSize: 200 } as Partial<PublicSearchQueryDto>);
    assert.equal(calls.take, 100, 'pageSize phải bị kẹp xuống 100');
    assert.equal(calls.skip, (3 - 1) * 100);
  });

  it('AC-2: lọc roomId + tìm q bằng ILIKE (param search = %kw%)', async () => {
    const calls: QbCalls = { joins: [], conditions: [], params: {} };
    await makeRepo([], 0, calls).searchPublicExhibits({ roomId: 'room-uuid', q: '  Gốm  ' } as Partial<PublicSearchQueryDto>);
    assert.equal(calls.params.roomId, 'room-uuid');
    assert.equal(calls.params.search, '%Gốm%', 'q phải được trim và bọc % cho ILIKE');
  });

  it('AC-4: sắp lại kết quả find theo đúng thứ tự id của QueryBuilder (ổn định qua 2 bước)', async () => {
    const idRows = [{ id: 'aaa' }, { id: 'bbb' }, { id: 'ccc' }];
    const calls: QbCalls = { joins: [], conditions: [], params: {} };
    const result = await makeRepo(idRows, 3, calls).searchPublicExhibits({});
    assert.deepEqual(result.items.map((x) => x.id), ['aaa', 'bbb', 'ccc']);
    assert.equal(result.total, 3);
  });
});
