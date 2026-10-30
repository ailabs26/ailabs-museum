import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { dataSource } from '../../../config/data-source';
import { Exhibit } from '../entities/exhibit.entity';
import { ExhibitRevision } from '../entities/exhibit-revision.entity';
import { Hotspot } from '../entities/hotspot.entity';
import { ExhibitsRepository } from '../repositories/exhibits.repository';

// ============================================================================
// VT-077 — INTEGRATION test THỰC THI SQL trên Postgres thật (tùy chọn).
// Chạy CHỈ KHI có DB thật và bật cờ (tránh phụ thuộc Postgres trong CI, tránh chạm DB chung ngoài ý muốn):
//   RUN_DB_IT=1 DATABASE_URL=postgres://... \
//     node -r reflect-metadata -r ts-node/register --test src/modules/exhibits/tests/public-search.integration.spec.ts
//
// CHỈ ĐỌC (SELECT) — không ghi/sửa/xóa dữ liệu. Mục tiêu: chứng minh truy vấn KHÔNG còn 500
// (lỗi distinctAlias.display_order) và ILIKE không còn khớp khóa JSON — hai lỗi fake QueryBuilder bỏ sót.
// ============================================================================

const ENABLED = process.env.RUN_DB_IT === '1' && !!process.env.DATABASE_URL;

describe('VT-077 searchPublicExhibits — Postgres thật (read-only)', { skip: !ENABLED }, () => {
  let repo: ExhibitsRepository;

  before(async () => {
    if (!dataSource.isInitialized) await dataSource.initialize();
    repo = new ExhibitsRepository(
      dataSource.getRepository(Exhibit) as never,
      dataSource.getRepository(ExhibitRevision) as never,
      dataSource.getRepository(Hotspot) as never,
    );
  });

  after(async () => {
    if (dataSource.isInitialized) await dataSource.destroy();
  });

  it('🔴#1: truy vấn join + phân trang chạy được, KHÔNG ném 500 (distinctAlias hợp lệ)', async () => {
    const result = await repo.searchPublicExhibits({ q: 'gốm', page: 2, pageSize: 5 });
    assert.ok(Array.isArray(result.items));
    assert.equal(typeof result.total, 'number');
    assert.equal(result.page, 2);
    assert.equal(result.pageSize, 5);
  });

  it('🟡: q là khóa JSON ("position"/"placeholderColor") KHÔNG khớp (tìm theo trường hiển thị)', async () => {
    const forKey = await repo.searchPublicExhibits({ q: 'placeholderColor', pageSize: 100 });
    assert.equal(forKey.total, 0, 'không được khớp tên khóa JSON nội bộ');
    const forHex = await repo.searchPublicExhibits({ q: '#8b7355', pageSize: 100 });
    assert.equal(forHex.total, 0, 'không được khớp giá trị màu nội bộ');
  });

  it('🟡: q="%" không trả về tất cả (wildcard đã escape)', async () => {
    const all = await repo.searchPublicExhibits({ q: '%', pageSize: 100 });
    assert.equal(all.total, 0, "ký tự '%' phải là literal, không phải wildcard");
  });

  it('AC-4 invariant: union 2 trang liên tiếp không trùng id (thứ tự ổn định)', async () => {
    const p1 = await repo.searchPublicExhibits({ page: 1, pageSize: 5 });
    const p2 = await repo.searchPublicExhibits({ page: 2, pageSize: 5 });
    const ids = new Set(p1.items.map((x) => x.id));
    for (const item of p2.items) assert.ok(!ids.has(item.id), `id ${item.id} xuất hiện ở cả 2 trang`);
  });
});
