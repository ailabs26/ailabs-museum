# Task: Dọn media mồ côi

Người phụ trách: Nguyễn Văn Thắng. Nhánh `feat/media-orphan-cleanup`. Phần C2 của task "Nâng cao".

## Bối cảnh

- Xóa media là xóa mềm, file được giữ vĩnh viễn để còn khôi phục từ Thùng rác, nên storage chỉ tăng mà không giảm.
- Upload ghi file trước rồi mới ghi DB (`MediaService.persist`). Nếu tiến trình chết giữa hai bước đó, file nằm lại mà không
  có bản ghi.

## Thay đổi

- `MediaStorageDriver.list(prefix)` cho cả hai driver:
  - local: duyệt đệ quy `publicRoot/uploads` và `quarantineRoot`, lấy `mtime`;
  - Supabase: `POST /storage/v1/object/list/{bucket}`, đi đệ quy vào thư mục con (`id: null`), phân trang 1000, lấy
    `updated_at`.
- `MediaStorageService.isManagedKey` / `listManaged`: chỉ nhận đúng key do `createKey` sinh ra (uuid, đúng thư mục/đuôi).
- `MediaRepository`:
  - `countPurgeable`;
  - `deletePurgeable` (DELETE … RETURNING, kiểm lại điều kiện ngay trong câu DELETE, `FOR UPDATE SKIP LOCKED`);
  - `findExistingStorageKeys`.
  - Điều kiện "không còn được tham chiếu" dựng từ `REVISION_MEDIA_SLOTS`, nên thêm slot mới thì job tự xét theo.
- `MediaCleanupService` (cron `30 3 * * *`):
  1. Media xóa mềm quá hạn và không còn được tham chiếu → xóa bản ghi (theo lô 200) + audit `media.purge` → xóa file
     (lỗi thì đếm vào `errors`, file đó được dọn ở lần sau).
  2. File được quản lý, không có bản ghi, cũ hơn 24 giờ → xóa (theo lô 500 key).
- Env `MEDIA_ORPHAN_CLEANUP=off|dry-run|on` (mặc định **dry-run**) và `MEDIA_TRASH_RETENTION_DAYS` (mặc định 30), đã thêm
  vào `.env.example`. `.env` local không đổi vì mặc định đã đủ.
- FE: tab "Đã xóa" của trang Media có dòng báo media sẽ bị xóa vĩnh viễn sau 30 ngày.

**Lưu ý vận hành:** chỉ bật `on` khi storage và DB đi cùng nhau. Chạy driver `local` mà trỏ DB khác thì mọi file cục bộ không
có trong DB đó đều bị coi là mồ côi. Đây là lý do mặc định là dry-run.

## Kiểm chứng ngày 03/11/2026

- Back-end: lint, typecheck đạt; `npm test` 2142/2142 với PostgreSQL 16 tạm (0 skip, 0 cancelled); coverage lõi 95,09%.
  - `media-cleanup.spec.ts`:
    - `isManagedKey` nhận 5 dạng đúng, từ chối 8 dạng lạ (model phòng, logo, thư mục lạ, lồng thư mục, `../`…);
    - driver local `list()` trên thư mục tạm;
    - dry-run không xóa và không audit;
    - `on` xóa đúng và audit đúng;
    - lỗi một file không dừng job;
    - nhiều lô (450 mục);
    - cron `off` / nuốt lỗi.
  - `supabase-storage-driver.spec.ts`: đệ quy, phân trang 1000, body request, lỗi API.
  - `media-repository.integration.spec.ts` (DB thật): chỉ xóa media quá hạn không còn tham chiếu (xét cả slot audio và phụ đề
    en); `findExistingStorageKeys`.
- Front-end: lint, typecheck đạt.
- Smoke với DI thật của app (`createApplicationContext(AppModule)`), driver local trong **thư mục tạm**, PostgreSQL tạm:
  - dry-run → `{purgedMedia: 1, orphanFiles: 1}`, không xóa gì;
  - `on` → media quá hạn và file mồ côi cũ đã xóa; media còn tham chiếu, media đang dùng, file mồ côi mới, `logo.png` và
    `rooms/phong.glb` vẫn còn;
  - 1 audit `media.purge` đúng media;
  - thư mục `public/media` thật của repo không bị thay đổi.
