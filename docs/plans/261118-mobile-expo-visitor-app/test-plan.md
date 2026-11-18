# Test Plan — Mobile Visitor App

## 1. Mục tiêu

Đảm bảo chất lượng tương đương chuẩn web hiện tại: logic domain có unit test, luồng chính có E2E, chạy được trên iOS + Android thật.

## 2. Tầng kiểm thử

| Tầng | Công cụ | Phạm vi | Chủ sở hữu |
| --- | --- | --- | --- |
| Unit | Jest | Helper thuần (hotspot, guided path, normalization, i18n, Zod), service unwrap | Mỗi người cho phần mình |
| Component | Jest + RNTL | Màn/UI component, trạng thái loading/error/empty | Mỗi người |
| E2E | Maestro (ưu tiên) | Luồng visitor đầu-cuối | TV5 (harness) |
| Manual device | Ma trận thiết bị | 3D/AR, cảm biến, hiệu năng | TV5 điều phối |
| A11y | VoiceOver/TalkBack + axe-rn | Luồng chính | TV5 |

## 3. Luồng E2E bắt buộc

1. Mở app → chọn phòng → duyệt catalogue → mở chi tiết → nghe audio (đổi locale).
2. Vào 3D → di chuyển camera → chọn hotspot → duyệt story prev/next → đóng.
3. Chạy guided tour → pause khi chọn hotspot → tiếp tục → thoát.
4. AR: mở AR → đặt model → chạm hotspot → thoát về màn trước.
5. Offline: tải phòng → bật máy bay → vẫn xem catalogue/chi tiết đã tải.
6. 2D fallback: ép GLB lỗi → nội dung vẫn đọc được.

## 4. Cổng chất lượng (CI)

- `lint` + `typecheck` xanh.
- Unit/component coverage logic domain **≥ 80%**.
- Maestro smoke flow xanh trên 1 simulator iOS + 1 emulator Android.
- Build EAS internal thành công.

## 5. Ma trận thiết bị (gợi ý)

| OS | Thiết bị | Mục tiêu |
| --- | --- | --- |
| iOS | iPhone đời cũ (A12-ish) + đời mới | AR (ARKit), 3D perf tiers |
| Android | 1 máy tầm trung + 1 flagship | ARCore, fallback máy yếu |
| Tablet | iPad / Android tablet (tùy chọn) | Layout lớn |

## 6. Dữ liệu test

- Fixture API tái dùng từ web (room/exhibit) + fixture GLB nhẹ.
- Tài khoản test cho luồng content-report (auth).

## 7. Hiệu năng (ngưỡng đề xuất — chốt lại)

- Cold start ≤ 3s trên máy tầm trung.
- 3D phòng ≥ 30fps máy tầm trung (có perf tier).
- Không rò renderer/memory qua nhiều lần mở/đóng scene (profiling như web `261104-real-device-3d-performance-audit`).

## 8. Báo cáo

- Mỗi milestone: báo cáo kiểm chứng + bằng chứng (clip/screenshot) trong `docs/plans/.../verification.md` (tạo khi triển khai).
