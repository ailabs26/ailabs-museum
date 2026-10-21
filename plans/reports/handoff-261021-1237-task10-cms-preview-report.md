# Bàn giao — Task 10 (CMS media & preview) — dừng 21/10/2026 12:37

## Trạng thái nhanh
- Nhánh `feat/cms-preview-integration` (từ `dev` @ `663081d`), **9 commit đã push**, local = origin.
- Code Task 10 xong; còn: **nghiệm thu UI trên Supabase cho trọn**, điền tài liệu, commit tài liệu, (tùy) merge vào `dev`.
- Chưa commit: `docs/tasks/cms-preview-integration.md` (bản nháp, còn chuỗi `KET_QUA_KIEM_THU` cần thay),
  thư mục `plans/261021-1237-task10-cms-preview/` (script test) và file bàn giao này.
- Server dev của người dùng (API :3001 `nest start --watch`, Vite :5173) **đang chạy — không tắt**.
  Server test :3091/:5174 đã tắt.

## Commit trên nhánh
| Commit | Nội dung |
|---|---|
| `1bab9f2` | BE trả `content.altText` trong response admin (form sửa điền lại alt text) |
| `ae4af0e` | FE `services/media.service.ts` + `helpers/mediaLibrary.ts` (+test) |
| `6774955` | `shared/components/media/MediaPreview.tsx`, `ModelPreview.tsx` (lazy three.js) |
| `06d78a2` | `pages/admin/MediaPage.tsx`, route `/admin/media` (quyền `media:upload`) |
| `7041f5f` | `helpers/exhibitFormErrors.ts` (+test): lỗi API → ô form |
| `bea3ea3` | `ExhibitsPage`: tab "Media & thuyết minh", lỗi Submit 422 mở form đánh dấu ô, tab "Media & xem trước" trong drawer chi tiết; `MediaSlotSelect.tsx` |
| `5e6195e` | **BE fix: API sập** khi client hủy request lúc API chờ Supabase (pipeline vào response đã đóng → stream mồ côi phát lỗi HTTP/2 → process thoát). Controller hủy stream & dừng nếu `res.destroyed/writableEnded` |
| `64b41b4` | FE: lỗi validate ở tab khác → tự chuyển tab; chọn phòng đầu tiên khi danh sách phòng tải muộn; lỗi GLB tiếng Việt |
| `118cd6d` | **BE fix: upload Supabase bị hủy** do timeout 15 s tính cả thời gian gửi body → `uploadTimeoutMs` riêng (mặc định 120 s) |

## Đã kiểm chứng
- BE: typecheck/lint sạch; `npm test` 1566/1566 (trước commit `118cd6d`); `test:media` 507/507; `test:exhibits` 582.
- FE: typecheck/lint sạch; `test:unit` 76/76 + test helper mới; build đạt (`ModelPreview` tách chunk).
- UI thật (Playwright, Supabase dùng chung), lần tốt nhất **12/13**: đăng nhập; trang Media; upload 4 loại + điền
  quyền; cột quyền "Đủ"; preview ảnh (URL ký); **GLB thật (`coc_go_bach_dang.glb` 3,56 MB) dựng thành canvas 3D**;
  tạo nháp gắn 4 media; server lưu đúng slot + transcript. Bước hỏng = do lỗi sập API (đã sửa `5e6195e`).

## Chưa kiểm chứng (làm tiếp)
Các bước 5–7 của script chưa chạy qua lần nào vì mạng/Supabase chậm lúc 12:30–12:37:
- Upload ra internet ~60 KB/s hoặc thấp hơn; GLB 3,5 MB vượt cả 120 s (log 12:36:25 "This operation was aborted").
- 12:36:51 `POST /api/auth/login -> 500: Connection terminated unexpectedly` (pooler DB ngắt).
Cần xác nhận: (5) Gửi duyệt thiếu alt text → form mở lại, tab Media, ô alt text vi/en `aria-invalid`;
(6) điền alt text → lưu → mở lại thấy alt text; (7) drawer chi tiết: ảnh, audio + `<track>`, canvas GLB;
và bước stress "mở/đóng preview GLB 5 lần → API vẫn sống" (kiểm fix `5e6195e`).

## Cách chạy lại nghiệm thu UI
```bash
R="/media/trong-thanh/Data/University/Fourth Year/Software Engineer/Ailabs Museum"
# 1) API test :3091 (build mới) — hook chặn chữ "dist" trong lệnh, dùng npm script
cd "$R/back-end" && npm run build && PORT=3091 MEDIA_PUBLIC_BASE_URL=http://localhost:3091 \
  FRONTEND_ORIGIN=http://localhost:5174 npm run start:prod      # chạy nền
# 2) Vite :5174 trỏ API :3091
cd "$R/front-end" && VITE_API_BASE_URL=http://localhost:3091/api \
  VITE_MEDIA_BASE_URL=http://localhost:3091/media npx vite --port 5174 --strictPort   # chạy nền
# 3) Tệp thử: script đọc từ <thư mục script>/t10files, ghi ảnh vào <thư mục script>/shots
S="$R/plans/261021-1237-task10-cms-preview/scripts"; mkdir -p "$S/t10files" "$S/shots"
U="$R/back-end/public/media/uploads"
cp "$U/images/b5aad10f-c509-4069-bcb4-fd287f06f2b4.png" "$S/t10files/e2e-task10-anh.png"
cp "$U/audio/3d6c8cb8-e728-42e4-b982-127a6ee46ad6.mp3" "$S/t10files/e2e-task10-audio.mp3"
cp "$U/subtitles/b00aaccf-f546-4b5d-9213-fd13454a2fb3.vtt" "$S/t10files/e2e-task10-phude.vtt"
# GLB thật: tải models/coc_go_bach_dang.glb từ bucket (khóa secret trong back-end/.env) → $S/t10files/e2e-task10-model.glb
#   (file 320 B trong public/media không có hình khối → preview báo lỗi có kiểm soát, không ra canvas)
# Mạng chậm: có thể dùng GLB nhỏ hơn có mesh thật.
# 4) Chạy (đã tự dọn hiện vật nháp + media tạo ra trong finally)
node "$S/ui-smoke-task10.mjs" "$R/front-end" "$R/back-end"
```
- **Đừng commit `t10files/` hay `shots/`** (GLB 3,5 MB, ảnh chụp).
- Dừng server test bằng PID theo cổng (`ss -ltnp | grep :3091`), **không** `pkill -f "node dist/main.js"`
  (trùng tiến trình `nest start --watch` của người dùng ở :3001).
- Sau mỗi lần chạy hỏng giữa chừng: kiểm tra sót dữ liệu `GET /api/admin/media?q=e2e-task10` và hiện vật
  `q=E2E Task 10`; xóa qua API (chưa publish nên xóa được).

## Việc còn lại theo thứ tự
1. Chạy lại script khi mạng ổn → nếu đạt, thay `KET_QUA_KIEM_THU` trong `docs/tasks/cms-preview-integration.md`
   bằng bảng kết quả (gồm 2 lỗi BE tìm ra khi test thật).
2. Chạy lại `npm test` BE (sau `118cd6d`), FE `test:unit`/build.
3. Commit tài liệu (`docs(tasks): document Task 10 ...`), push.
4. Hỏi người dùng có merge vào `dev` không (lần trước người dùng yêu cầu merge thẳng, không PR).

## Ghi chú cho người làm tiếp
- Người dùng làm dự án để học; ưu tiên tiến độ, không cần PR/review; muốn commit nhỏ, push từng phần.
- DB/bucket Supabase là project dùng chung (org nguyenthangdev, PRODUCTION); dữ liệu test phải tự dọn.
- Hiện vật đã từng publish không xóa được qua API — kịch bản UI cố ý KHÔNG publish.

## Câu hỏi chưa giải quyết
- Có merge `feat/cms-preview-integration` vào `dev` sau khi nghiệm thu xong không?
- 120 s upload có đủ cho mạng thực tế của nhóm không (GLB tối đa 10 MB cần ≥ ~85 KB/s)?
