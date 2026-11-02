import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { metadataExhibitsRepository, distinctPaginationSql } from './metadata-datasource';

// ============================================================================
// VT-077 — SQL-LEVEL test (không cần Postgres) trên metadata TypeORM THẬT.
// Mục tiêu: bắt đúng 2 lỗi reviewer báo mà fake QueryBuilder KHÔNG thấy, và chốt
// bản sửa ILIKE. Đây là bài học "who tests the tests": unit test mock cho GREEN giả.
//   - 🔴#1 SQL 500 trên Postgres: cột ORDER BY không được select → subquery distinctAlias hỏng.
//   - 🔴#2 lộ hiện vật phòng không ACTIVE: thiếu điều kiện theo room.
//   - 🟡 ILIKE khớp khóa JSON + không escape %/_.
// ============================================================================

/** Lấy các cột `"distinctAlias"."x"` mà ORDER BY ngoài tham chiếu. */
function distinctColsReferenced(outer: string): string[] {
  return [...outer.matchAll(/"distinctAlias"\."([a-z_]+)"/g)].map((m) => m[1]);
}
/** Lấy các cột được truy vấn TRONG select ra (alias sau AS). */
function innerColsProduced(inner: string): Set<string> {
  return new Set([...inner.matchAll(/ AS "([a-z_]+)"/g)].map((m) => m[1]));
}

describe('VT-077 searchPublicExhibits — SQL sinh ra (metadata thật, không DB)', () => {
  it('🔴#1 invariant: MỌI cột trong ORDER BY của subquery phân trang đều được select ở truy vấn trong', async () => {
    const repo = await metadataExhibitsRepository();
    // Có join (room, publishedRevision) + take ⇒ TypeORM dùng subquery distinctAlias.
    const qb = repo.buildPublicSearchIdQuery({ q: 'gốm' }).skip(20).take(20);
    const { inner, outer } = distinctPaginationSql(qb);

    const produced = innerColsProduced(inner);
    const referenced = distinctColsReferenced(outer);
    for (const col of referenced) {
      assert.ok(
        produced.has(col),
        `cột ORDER BY "${col}" KHÔNG được select ở truy vấn trong ⇒ Postgres: column "distinctAlias.${col}" does not exist (500). ` +
          `Inner select hiện có: ${[...produced].join(', ')}`,
      );
    }
    // Chốt cụ thể: display_order phải có mặt (regression của bản cũ `select(['exhibit.id'])`).
    assert.ok(produced.has('exhibit_display_order'), 'thiếu exhibit_display_order trong select');
  });

  it('🔴#2 ranh giới phòng: innerJoin rooms + lọc room ACTIVE và chưa xóa', async () => {
    const repo = await metadataExhibitsRepository();
    const qb = repo.buildPublicSearchIdQuery({});
    const sql = qb.getQuery();
    const params = qb.getParameters();

    assert.match(sql, /INNER JOIN "rooms"/, 'phải innerJoin rooms (hiện vật bắt buộc thuộc 1 phòng công khai)');
    assert.match(sql, /"room"\."status" = :roomStatus/);
    assert.match(sql, /"room"\."is_deleted" = :roomDeleted/);
    assert.equal(params.roomStatus, 'active');
    assert.equal(params.roomDeleted, false);
  });

  it('🟡 ILIKE: chỉ trường hiển thị, KHÔNG cast cả content sang text, có ESCAPE', async () => {
    const repo = await metadataExhibitsRepository();
    const sql = repo.buildPublicSearchIdQuery({ q: 'abc' }).getQuery();

    assert.doesNotMatch(
      sql,
      /CAST\(\s*"?publishedRevision"?\."?content"?\s+AS\s+text\)/i,
      'không được cast cả JSONB content sang text (khớp nhầm khóa JSON + trường nội bộ)',
    );
    // Có tìm trong tên/mô tả song ngữ.
    assert.match(sql, /"publishedRevision"\."content"->'name'->>'vi'/);
    assert.match(sql, /"publishedRevision"\."content"->'description'->>'en'/);
    // Mọi mệnh đề ILIKE đều kèm ESCAPE để %/_ không thành wildcard.
    const ilikeCount = (sql.match(/ILIKE :search/g) ?? []).length;
    const escapeCount = (sql.match(/ILIKE :search ESCAPE '\\'/g) ?? []).length;
    assert.ok(ilikeCount > 0 && ilikeCount === escapeCount, 'mọi ILIKE phải có ESCAPE');
  });

  it("🟡 escape wildcard: q='50%_off' được escape %/_ trong param", async () => {
    const repo = await metadataExhibitsRepository();
    const qb = repo.buildPublicSearchIdQuery({ q: '50%_off' });
    assert.equal(qb.getParameters().search, '%50\\%\\_off%', 'phải escape cả % và _');
  });

  it('AC-4 thứ tự ổn định: ORDER BY roomId, displayOrder, id (khớp index room_order_id)', async () => {
    const repo = await metadataExhibitsRepository();
    const sql = repo.buildPublicSearchIdQuery({}).getQuery();
    // Các cột order-by nằm trong SELECT nên TypeORM sắp theo alias; id ở CUỐI = tiebreaker duy nhất.
    assert.match(
      sql,
      /ORDER BY "exhibit_room_id" ASC, "exhibit_display_order" ASC, "exhibit_id" ASC/,
    );
  });
});
