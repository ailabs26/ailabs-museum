# Visitor Experience — Kế hoạch triển khai

> Thực thi theo `superpowers:executing-plans`, từng phần có kiểm chứng và commit. Đề bài người dùng là đặc tả được ủy quyền; tự quyết định chi tiết trong phạm vi, không dừng ở plan. Không push/PR/merge.

**Mục tiêu:** hoàn thiện 5 tiện ích cá nhân của khách tham quan, bảo toàn luồng 2D/3D hiện có.
**Base:** `origin/dev` = `a9591858d77312a36efb5b6e891ea400d55ac94f`, fetch ngày 30/10/2026.
**Nhánh:** `feat/visitor-experience-toolkit`; làm trong workspace hiện tại theo yêu cầu.
**Stack:** React 18, TypeScript strict, Mantine 7, TanStack Query, Zod, Vitest, Playwright; không dependency mới.

## Khảo sát và quyết định

Đã đọc root AGENTS, README root/frontend, kiến trúc frontend/data API, conventions, tasks collection/detail/public visitor, plans loading accessibility, hook/schema/service public, router/layout, MuseumPage, grid/media, fixtures/tests và public controllers/services/mappers backend. Không có AGENTS lồng nhau. `front-end/docs/coding-conventions.md` không tồn tại; dùng `docs/architecture/fe/coding-conventions.md` thực tế.

| Hành vi | Hiện trạng / owner | File nguy cơ | Quyết định |
|---|---|---|---|
| Danh sách/phòng/search | CollectionPage, useMuseumRooms, museumService, Zod; URL giữ phòng; search nội bộ phòng | CollectionPage | Giữ search, thêm filter yêu thích độc lập |
| Chi tiết, audio/transcript/report/deep link | ExhibitDetailPage + shared media/feedback | ExhibitDetailPage | Thêm UI nhỏ; giữ player, headings, credits, report |
| Yêu thích/gần đây/ghi chú/reading | Chưa có ở visitor modules | helpers/hooks visitor và components cạnh pages | Persistence version 1, validation, bounded input, fallback RAM, status lỗi |
| So sánh | Chưa có | CollectionPage + component mới | Session state 2–3 ref; Modal Mantine; DTO thật, không GLB |
| Public validation | museumService.getRoom đối chiếu room ID/slug; schema đối chiếu exhibit.roomId | Không sửa | Dùng lại query keys public và AbortSignal |
| 3D/fallback/fullscreen | MuseumPage, lazy scene, catalogue/detail DOM | Không sửa | Hồi quy bằng existing fixture tests |
| Bug memo | exhibits được sort/tạo mới mỗi render rồi làm dependency | CollectionPage | Baseline eslint xác nhận warning exhaustive-deps; sửa memo và bảo vệ sort/filter bằng browser test |
| PR #130 | Draft OPEN, ducqwang, `feat/VT-077-public-exhibit-search`, base a959185; 9 files backend/README/perf/tests | Không giao file với nhiệm vụ này | Không sửa search API/contract hoặc backend |
| Issues mở | #110 partner auth, #111 CMS quyền, #112 seed RBAC, #113 partner/translation tests | Ngoài visitor | Chỉ ghi nhận; không can thiệp |

GitHub search PR rỗng lần đầu không trả PR; kiểm tra lại bằng `repo:ailabs26/ailabs-museum is:open` xác nhận #130 là PR mở. Issues chưa có phần trùng 5 tính năng.

## Kiến trúc và invariants

- Các store riêng cho favorites (tối đa 100 refs), recent (20 refs), reading (enabled + scale 1–1.5), notes (100 mục × 2.000 ký tự). Namespace `aura:visitor:*:v1`, envelope version 1, strict Zod. Chỉ lưu cặp roomId/exhibitId, không snapshot DTO/URL.
- Store nhỏ dùng useSyncExternalStore, đọc snapshot ổn định; listener storage chỉ khi subscribed và cleanup. Đọc storage mới trước mutation để giữ các thay đổi khác tab; cùng mục ghi sau thắng. Lỗi quota/security giữ RAM và thông báo chưa lưu, không crash hoặc tuyên bố đã lưu.
- Favorites tại collection/detail; filter chỉ phòng đang chọn (có nhãn rõ), phối hợp search hiện tại. Room/exhibit bị gỡ không được hiện qua ref cũ.
- Recent chỉ ghi khi detail valid thành công, dedupe, mới nhất trước, giới hạn 20; list ở collection có clear. Resolve refs qua danh sách public + getRoom đã validate, chỉ fetch các phòng cần thiết; lỗi không dùng snapshot cũ.
- Comparison giữ refs trong CollectionPage suốt đổi phòng; resolve public giống recent, không lưu dữ liệu API. Tối đa 3; bỏ từng mục/clear; Modal có focus trap/return/Escape; chỉ tên/ảnh/mô tả/phòng từ DTO, credits nếu có.
- Reading CSS scoped trong detail, scale giới hạn, width/line-height khi bật, reset; không ảnh hưởng CMS/tour/global typography. Không thêm animation.
- Notes autosave đồng bộ mỗi input (không timer nên không mất đoạn cuối khi navigation); lỗi vẫn giữ bản nháp trong RAM và cho retry. Textarea plain text, maxlength, status, giới hạn số ghi chú rõ ràng.

## Các lựa chọn đã cân nhắc

1. Backend/account sync: trái phạm vi và cần dữ liệu mới → loại.
2. Một provider global gom tất cả: mở rộng lifecycle tới CMS/tour không cần thiết → loại.
3. Store trình duyệt nhỏ + component visitor, API/query hiện có để resolve → chọn vì hoàn thiện luồng mà không đổi contract.

## Thứ tự thực thi

- [ ] T1: Commit bộ kế hoạch và baseline.
- [ ] T2: Persistence + validation + unit tests read/write/version/error/limits/cross-tab.
- [ ] T3: Favorites grid/detail + filter + browser tests.
- [ ] T4: Recent recording/resolver/list/clear + tests.
- [ ] T5: Comparison selection/tray/dialog + tests.
- [ ] T6: Reading preferences + scoped CSS + tests.
- [ ] T7: Private notes autosave/errors/isolation + tests.
- [ ] T8: Memo warning fix + regression; tổng gates và visitor regressions.
- [ ] T9: Independent review, fix findings, fetch đối chiếu remote, docs bàn giao.

## Review focus

Storage dữ liệu hỏng/quá lớn/blocked/quota; cross-tab và stale closure; ref công khai bị gỡ/phòng ẩn/response sai; nhanh đổi phòng/exhibit; keyboard/focus sau unselect/close; mobile và 200% zoom; callbacks shared phải optional; không HTTP write/Canvas từ tiện ích.

## Stop condition

5 tính năng có luồng đầy đủ + unit/browser proof; frontend typecheck/lint/unit/build không lỗi mới; full diff trong scope và commit atomic; tài liệu ghi rõ giới hạn. Không migration/backend/CMS/auth/XR/deployment. Không push, mở PR, merge.
