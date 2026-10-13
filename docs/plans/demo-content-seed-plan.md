# Demo Content Seed — Implementation Plan

> **For agentic workers:** Dùng Superpowers `executing-plans` để thực hiện trong phiên hiện tại, kiểm tra và commit từng phần độc lập. Không dùng subagent trong nhiệm vụ này.

**Goal:** Seed 5 hiện vật mẫu đã công khai vào phòng lịch sử quân sự hiện có và kiểm chứng Supabase/API.

**Architecture:** Script CLI dùng data source hiện có, gọi hàm seed xuất khẩu để test bằng Node test runner. Một transaction khóa phòng, kiểm tra admin và bộ ID, chỉ tạo bộ đôi exhibit/revision còn thiếu hoàn toàn. Bộ đã có được giữ nguyên, bất thường gây rollback.

**Tech Stack:** NestJS backend TypeScript/CommonJS, TypeORM/PostgreSQL, ts-node, Node test/assert; frontend Zod schema dùng cho kiểm tra phản hồi API.

## Global Constraints

- Thiết kế đã được người dùng duyệt: [demo-content-seed-design.md](demo-content-seed-design.md).
- Nhánh `feat/demo-content-seed`, base `896f39b`; phòng `phong-lich-su-quan-su-viet-nam`.
- Không migration, thay schema, frontend, media upload hoặc dữ liệu quản trị.
- Mọi tên có `[Mẫu]`; không khẳng định provenance lịch sử chưa xác minh.
- UUID cố định riêng cho 5 exhibit và 5 revision, transaction nguyên tử và room lock.
- Chạy lại bỏ qua dữ liệu đã sửa/ẩn/xóa mềm; không reset version hoặc published revision.
- Room/admin thiếu hoặc không hợp lệ, ID xung đột/bộ đôi thiếu: lỗi và rollback.
- Dùng admin đã có qua `SEED_ADMIN_EMAIL`, không cần mật khẩu để seed nội dung.
- Người dùng cho phép commit hợp lý theo task; không push/PR/merge nếu chưa yêu cầu.

## File map và interface

| File | Trách nhiệm |
|---|---|
| `back-end/src/database/seeds/demo-content.ts` | Slug và 5 nội dung/UUID cố định |
| `back-end/src/database/seeds/seed-demo-content.ts` | Transaction seed, lifecycle và CLI |
| `back-end/src/database/seeds/seed-demo-content.spec.ts` | Kiểm tra hành vi không dùng DB thật |
| `back-end/package.json` | `seed:demo` và `test:seed` |
| `back-end/README.md` | Điều kiện chạy và giới hạn demo |
| `docs/tasks/demo-content-seed.md` | Trạng thái, ledger commit và bằng chứng |

Exports: `DEMO_ROOM_SLUG: string`, `DEMO_EXHIBITS` chứa `id/revisionId/displayOrder/content`; `seedDemoContent(source: DataSource, adminEmail: string): Promise<{ created: number; skipped: number }>`; `runDemoContentSeed(source: DataSource, env: NodeJS.ProcessEnv): Promise<{ created: number; skipped: number }>` kiểm tra env, initialize và finally destroy.

## SEED-01: Thiết kế và kế hoạch

- [x] Đọc entity/config/seed/API và schema Day 2, xác minh phòng/admin tồn tại bằng truy vấn chỉ đọc.
- [x] Người dùng duyệt dùng phòng hiện có, bộ 5 nội dung và thiết kế idempotent.
- [x] Ghi task, design, kế hoạch và quyền commit theo phần.
- [x] Review diff và commit ba tài liệu (`ce47621`):

```powershell
git add -- docs/tasks/demo-content-seed.md docs/plans/demo-content-seed-design.md docs/plans/demo-content-seed-plan.md
git diff --cached --check
git diff --cached
git commit -m "docs(seed): plan demo content for existing museum room"
```

## SEED-02: Script có kiểm tra hành vi

- [x] Tạo test trước implementation, dùng `node:test`, `node:assert/strict` và mock tối thiểu TypeORM transaction/manager theo convention test hiện có. Kiểm tra lần đầu, chạy lại bảo toàn bản sửa/ẩn, xung đột ID, room/admin không hợp lệ, lỗi đóng kết nối.

Ví dụ assertion chống ghi đè, dùng kết quả hai lần seed và dữ liệu đã sửa trong test:

```ts
const first = await seedDemoContent(source, 'admin@example.test');
assert.deepEqual(first, { created: 5, skipped: 0 });
const item = exhibits.get(DEMO_EXHIBITS[0].id)!;
item.visibility = ExhibitVisibility.HIDDEN;
item.version = 7;
const before = structuredClone([...exhibits.values()]);
assert.deepEqual(await seedDemoContent(source, 'admin@example.test'), { created: 0, skipped: 5 });
assert.deepEqual([...exhibits.values()], before);
```

- [x] Chạy test trực tiếp: thất bại TS2307 do module implementation chưa tồn tại; không phải assertion RED runtime:

```powershell
node -r reflect-metadata -r ts-node/register --test src/database/seeds/seed-demo-content.spec.ts
```

- [x] Tạo data module 5 mẫu theo design; UUID v4 riêng, shape/color hợp lệ, position y=0 và trong phòng; mô tả rõ demo. Không phụ thuộc mẫu frontend hoặc import entity runtime vào data thuần.
- [x] Triển khai transaction: lock phòng bằng `pessimistic_write`, admin active/chưa xóa và có role admin, kiểm tra toàn bộ 5 bộ đôi trước ghi. Khi ID revision không thuộc exhibit hoặc ID exhibit thuộc phòng khác thì throw. Với bộ đôi đã có, không kiểm tra/khôi phục trạng thái publish hiện hành.
- [x] Tạo exhibit hidden trước revision vì khóa ngoại; tạo revision approved/createdBy/reviewedBy/reviewedAt; cập nhật exhibit visible/publishedRevisionId/version=1. Có lỗi thì transaction rollback toàn bộ; finally đóng kết nối CLI. Log chỉ count/thông báo kiểm soát; không dump exception có credential.
- [x] Lệnh npm và README:

```json
"seed:demo": "ts-node src/database/seeds/seed-demo-content.ts",
"test:seed": "node -r reflect-metadata -r ts-node/register --test src/database/seeds/seed-demo-content.spec.ts"
```

- [x] GREEN (6/6 tests) và quality gates từ `back-end/`:

```powershell
npm.cmd run test:seed
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

- [ ] Review, stage đúng 5 file implementation/README/package và task update; commit `feat(seed): add idempotent demo content seed with checks`. Không stage `.env`, dist hoặc dependency lock vì không thêm dependency.

## SEED-03: Chạy và chứng minh tích hợp

- [ ] Chụp snapshot chỉ đọc metadata phòng và các cột exhibit/revision demo liên quan để so sánh. Không in credential hoặc passwordHash.
- [ ] Chạy `npm.cmd run seed:demo` trên Supabase đã chỉ định; xác minh 5 cặp approved/public và liên kết cùng phòng.
- [ ] Chụp dữ liệu demo sau lần đầu, chạy lần hai, so sánh count/content/version/publishedRevisionId/timestamps; không giả lập thay đổi nội dung trên DB dùng chung để test.
- [ ] Gọi public list/detail ở `/api/rooms`, kiểm tra đủ 5 UUID demo theo displayOrder 0–4; dùng frontend `roomResponseSchema(roomDetailSchema).parse(response)` qua ts-node với config CommonJS tạm/inline để xác minh contract. Không dùng endpoint metadata `/api/public/rooms/:slug` để chứng minh có exhibits.
- [ ] Kiểm tra API room không tồn tại trả 404; kiểm tra phạm vi thay đổi phòng và dữ liệu quản trị không bị ảnh hưởng.
- [ ] Ghi bằng chứng thật, giới hạn media null và không phải dataset nghiệm thu. Commit docs `docs(seed): record Supabase seed and API verification`.

## Commit ledger

Ghi SHA sau mỗi commit trong task; commit docs cuối tự được tra bằng `git log` thay vì ghi SHA của chính nó. Không sửa lịch sử, không commit rỗng để đạt số lượng. Kiểm chứng DB là thao tác dữ liệu, không tạo commit DB giả.

## Self-review

Phạm vi thiết kế ánh xạ SEED-02 (script/transaction/idempotency) và SEED-03 (DB/API/schema). Room/admin giữ nguyên; ID cố định cùng shape hợp lệ và tọa độ trong giới hạn Day 2. Bản ghi demo bị chỉnh sửa được skip; bất thường quan hệ dừng toàn bộ. Dùng tests fake để chứng minh nhánh logic và truy vấn DB/API thật để chứng minh tích hợp, không đánh đồng hai loại bằng chứng.
