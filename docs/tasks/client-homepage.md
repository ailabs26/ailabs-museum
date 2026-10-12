# Task T-HOME: Giao diện trang chủ Aura Museum

Nhánh: `feat/client-homepage`.
Base khi bắt đầu: `origin/dev` tại `1ee2f41`.
Plan: [client-homepage-plan.md](../plans/client-homepage-plan.md).
Convention: [frontend coding conventions](../../front-end/docs/coding-conventions.md).
Trạng thái: đã triển khai và kiểm tra kỹ thuật; chờ duyệt giao diện trực quan.

## Mục tiêu

Hoàn thiện trang chủ React tại `/` để giới thiệu Aura Museum và dẫn người dùng tới bộ sưu tập 2D. Đây là lượt đầu của nhiệm vụ trang chủ/danh mục, chưa bao gồm dữ liệu hiện vật từ API.

## Phạm vi đã được người dùng đồng ý

- Header có logo Aura, Trang chủ và Bộ sưu tập.
- Hero có tiêu đề, mô tả và CTA `Khám phá bộ sưu tập` tới `/collection`.
- Giới thiệu bảo tàng và footer có liên kết điều hướng.
- Giao diện nền kem, điểm nhấn teal; hỗ trợ light/dark và responsive.
- Tham quan 3D hiển thị `Sắp ra mắt`, chưa là CTA hoạt động.
- Giữ tiêu đề `Hiện vật nổi bật`, để trống vùng nội dung bên dưới; không gọi API nội dung hoặc thêm hiện vật giả.
- Metadata và favicon dùng logo sẵn có.

## Phụ thuộc và giới hạn

- Dùng React, Mantine, React Router, Tabler icons và logo hiện có; không thêm dependency.
- Không phụ thuộc seed, Supabase hoặc PR Day 2 để hoàn thành lượt này.
- `/collection` hiện là placeholder: điều hướng được tới trang đó không có nghĩa danh mục đã hoàn thành.
- `PublicLayout` dùng chung cho các route public; review cần kiểm tra cả `/collection` và `/tour`.
- Theme admin và luồng khôi phục phiên đăng nhập giữ nguyên. `AuthProvider` sẵn có vẫn có thể gọi API xác thực khi mở trang public.
- Không thay đổi backend, database hoặc schema trong nhiệm vụ này.

## Task và trạng thái

| Task | Deliverable | Trạng thái |
|---|---|---|
| HOME-01 | Public layout, header/footer, skip link và navigation | Đã triển khai; kiểm tra điều hướng và skip link đạt |
| HOME-02 | Hero, giới thiệu, vùng nổi bật trống và metadata | Đã triển khai; kiểm tra heading và không gọi API phòng đạt |
| HOME-03 | Quality gates và kiểm chứng responsive | Typecheck/lint/build đạt; kiểm tra DOM bốn viewport light/dark đạt |
| HOME-04 | Người dùng duyệt bố cục, màu và khoảng trống | Chưa hoàn thành |

## Điều kiện nghiệm thu

- [x] Trang `/` có một `h1`, các mục giới thiệu/nổi bật dùng `h2`.
- [x] Logo quay về `/`; CTA và liên kết Bộ sưu tập tới `/collection`.
- [x] Navigation có nhãn và trạng thái trang hiện tại.
- [x] Skip link nhận focus và chuyển focus tới `main`.
- [x] Không tràn ngang ở 320, 768, 1024 và 1440 px trong light/dark.
- [x] Hiện vật nổi bật không có thẻ dữ liệu hoặc request `/api/rooms`.
- [x] Tham quan 3D hiển thị `Sắp ra mắt`.
- [x] Frontend typecheck, lint và build đạt.
- [ ] Người dùng duyệt giao diện trực quan desktop/mobile.

## Bằng chứng và phần còn lại

Kiểm tra Edge bằng Playwright CLI trong phiên triển khai: assertions điều hướng, heading, skip link, responsive và không gọi API phòng đạt. Đã chụp ảnh nhưng phiên không hỗ trợ đọc ảnh, nên chưa có bằng chứng review trực quan.

Console còn 401 từ `/api/auth/me` của luồng khôi phục phiên sẵn có. Không có cơ sở tuyên bố console hoàn toàn sạch. Build có cảnh báo bundle lớn hơn 500 kB.

Kế hoạch chi tiết được bổ sung sau triển khai để khắc phục thiếu sót quy trình; không có bằng chứng chu kỳ RED/GREEN. Chưa push hoặc tạo PR. Chỉ thực hiện các thao tác Git tiếp theo khi có yêu cầu.

## Commit theo task

| Task | Commit | Nội dung |
|---|---|---|
| Plan/task | `43abd5a` | Tài liệu phạm vi và kế hoạch |
| HOME-01 | `4e51d41` | Public layout, navigation, skip link, footer và CSS |
| HOME-02 | `e210b14` | Nội dung trang chủ, CSS và metadata |
| HOME-03 | Commit cập nhật tài liệu kiểm chứng này | Ghi kết quả quality gates chạy lại trước commit |

Typecheck/lint/build đã chạy lại và đạt trước commit HOME-01/02; build tiếp tục cảnh báo bundle >500 kB. Không chạy lại browser vì không có thay đổi runtime kể từ lần kiểm chứng trước. HOME-04 chưa hoàn thành; commit code không thay thế duyệt trực quan hoặc review PR.
