# Task T-PREVIEW: Minh họa hiện vật 2D dùng chung

**Nhánh:** `feat/shared-exhibit-preview`, base `c814655` từ `origin/dev`.
**Trạng thái:** Đã triển khai và kiểm chứng kỹ thuật/API thật; chờ người dùng duyệt trực quan và PR.
**Plan:** [shared-exhibit-preview-plan.md](../plans/shared-exhibit-preview-plan.md).

## Mục tiêu và quyết định

Hiển thị minh họa hình khối CSS từ loại hình và màu API thay cho vùng trống ảnh, dùng chung ở collection, hiện vật nổi bật, danh mục tour và panel chi tiết. Các khối trong Canvas vẫn do Three.js dựng từ cùng dữ liệu; component DOM không thay thế renderer 3D.

Tái sử dụng kỹ thuật CSS trong `MuseumCatalogue` hiện có. Không seed ảnh, tạo file ảnh, upload hoặc ghi Supabase: `placeholderShape`/`placeholderColor` đã có trong dữ liệu.

## Phạm vi

- Component `ExhibitPreview` trong `shared/components/data/`, nhận shape/color và className tùy chọn để giữ kích thước vùng minh họa theo vị trí.
- Hỗ trợ shape API `box`, `sphere`, `cylinder`, `cone`, `torus`; `cube` của mapper tour tương đương `box`, `icosahedron` tương thích kiểu display cũ.
- Minh họa là DOM/CSS, không Canvas, WebGL hoặc tải asset. Hình mang tính trang trí, `aria-hidden`; caption văn bản vẫn đọc được.
- Caption chung: **“Hình minh họa thay thế”** và **“Chưa có ảnh”**. Không gọi đây là ảnh/model thật của hiện vật.
- Collection/home dùng `placeholderShape`/`placeholderColor`; danh mục/panel tour dùng `display.shape`/`display.color` đã được mapper xử lý.
- Giữ tên, mô tả, transcript/hotspot, selection, nút và focus hiện tại. Đổi vị trí preview trong panel không được che nội dung hoặc tạo tràn ngang.
- Bỏ CSS hình khối trùng khỏi danh mục tour sau khi chuyển component.

## Giới hạn ảnh thật

Lượt này chỉ hỗ trợ minh họa. Schema hiện bắt buộc `image: null`, backend cũng trả null. Sau này cần media public contract, cập nhật schema/mapper và thêm hiển thị ảnh thật/lỗi ảnh tại component chung. Không thêm props ảnh, URL giả hoặc logic tải ảnh chưa có đầu vào trong lượt này.

## Task và commit dự kiến

| Task | Công việc | Commit |
|---|---|---|
| PREVIEW-01 | Duyệt tài liệu rồi commit task/plan | `docs(preview): plan shared 2D exhibit illustration` |
| PREVIEW-02 | Component và tích hợp bốn vị trí, regression tests | `feat(preview): share CSS exhibit illustration across public views` |
| PREVIEW-03 | Live verification, README và bằng chứng | `test(preview): verify shared illustrations with public API` |

Commit theo thay đổi có thể kiểm chứng; không tạo commit rỗng. Push/PR chỉ sau khi được người dùng duyệt và có yêu cầu.

## Điều kiện nghiệm thu

- [x] Người dùng duyệt task/plan trước commit/sửa code.
- [x] Cả bốn vị trí hiển thị cùng component, shape/color theo dữ liệu được validate.
- [x] API box/tour cube chuẩn hóa cùng data-shape box; năm shape API có CSS minh họa; ico giữ tương thích legacy (chưa có fixture API).
- [x] Caption rõ minh họa, không giả vờ có ảnh thật.
- [x] WebGL bị chặn: collection/home và danh mục/panel vẫn minh họa và đọc được.
- [x] Tests API lỗi/rỗng giữ trạng thái, không dùng demo fallback.
- [x] Selection, đóng panel/focus, tên/mô tả/transcript/hotspot giữ hành vi.
- [x] DOM reflow 320/768/1024/1440 px light/dark đạt; hình khác nhau và caption không phụ thuộc màu.
- [x] Typecheck/lint/build, focused tests và live API check đạt.
- [ ] Người dùng duyệt trực quan; gửi mô tả PR trước tạo.

## Ngoài phạm vi

Không thay backend/schema/query hooks/database/seed/dependency, model 3D thật, ảnh upload hoặc trang chi tiết 2D riêng. Không tuyên bố đây là bước hoàn thành bộ asset nghiệm thu.

## Ledger và bằng chứng PREVIEW-02

- PREVIEW-01 commit `79785bf`: task/plan đã duyệt trước code.
- Test mới đầu thất bại đúng vì collection chưa có element data-shape (3 tests còn lại không chạy do max-failures). Sau implementation: focused preview/collection/home/tour-interaction/font 37/37 đạt (2.7m).
- Typecheck/lint/build đạt. Build cuối main 1,378.32 kB, scene 851.31 kB; cảnh báo bundle >500 kB còn tồn tại.
- Các lỗi chờ dữ liệu home trong regression liên quan AuthProvider mới cancel/clear queries khi auth hết phiên; fixture nội dung cũ trả 401 /auth/me, dẫn tới race với fetch public. Chỉ sửa fixture nội dung trả auth response hợp lệ không quyền để cô lập tests presentation, không đổi production auth hoặc tuyên bố anonymous auth đã sửa. Lần thử mock refresh 401 không giải quyết được race; đã thay bằng fixture hợp lệ. Test reflow có 16 navigation cần timeout 60s.
- Minh họa không tải asset, không render Canvas. Tour CSS surface giữ palette warm để caption có tương phản ở dark mode; DOM shape aria-hidden nhưng caption đọc được.
- PREVIEW-02 commit `35b88e1`. Visual review chưa thực hiện trong phiên.

## Bằng chứng PREVIEW-03

- `MUSEUM_LIVE_TEST=1`, `npm.cmd test -- exhibit-preview-live.spec.ts`: 1/1 đạt (9.6s), không interception/DB writes. API/schema response thật khớp shape/color ở cả bốn vị trí, không Canvas khi đọc DOM.
- Probe chỉ đọc xác nhận phòng đầu `phong-lich-su-quan-su-viet-nam` có 5 items, image null: sphere/cylinder/box/torus/box với màu seed tương ứng. Không đổi dữ liệu hoặc renderer 3D.
- Unit tests 6/6, typecheck/lint đạt sau thêm live test. Build runtime cuối đạt trước khi thêm docs/tests; không chạy lại build không cần thiết.
- Tests preview responsive/caption/panel đã đạt, nhưng phiên không đọc ảnh chụp; chờ người dùng duyệt trực quan. Không có full-suite/axe/physical-device claims. Chưa push/PR.
