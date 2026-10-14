# Task T-PREVIEW: Minh họa hiện vật 2D dùng chung

**Nhánh:** `feat/shared-exhibit-preview`, base `c814655` từ `origin/dev`.
**Trạng thái:** Người dùng đã duyệt task/plan và yêu cầu triển khai trên nhánh riêng.
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
- [ ] Cả bốn vị trí hiển thị cùng component, shape/color theo dữ liệu được validate.
- [ ] `box` và `cube` hiển thị nhất quán; các loại khối được phân biệt theo CSS hiện có.
- [ ] Caption rõ minh họa, không giả vờ có ảnh thật.
- [ ] Khi WebGL bị chặn, collection/home và danh mục/panel vẫn minh họa và đọc được.
- [ ] API lỗi vẫn báo lỗi, không tự dựng danh sách mẫu để che lỗi.
- [ ] Selection, đóng panel/focus, tên/mô tả/transcript/hotspot giữ hành vi.
- [ ] Không tràn ngang 320/768/1024/1440 px light/dark; không chỉ dùng màu để báo ý nghĩa.
- [ ] Typecheck/lint/build, focused tests và live API check đạt.
- [ ] Người dùng duyệt trực quan; gửi mô tả PR trước tạo.

## Ngoài phạm vi

Không thay backend/schema/query hooks/database/seed/dependency, model 3D thật, ảnh upload hoặc trang chi tiết 2D riêng. Không tuyên bố đây là bước hoàn thành bộ asset nghiệm thu.
