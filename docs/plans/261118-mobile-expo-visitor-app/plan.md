# Roadmap & Kế hoạch triển khai — Mobile Visitor App

## 1. Tổng quan phase

6 phase, mỗi phase ~2 tuần (giả định sprint 2 tuần, 5 dev). Timeline tổng ~12 tuần cho MVP.

| Phase | Tên | Mục tiêu chính | Milestone |
| --- | --- | --- | --- |
| P0 | Khởi tạo & nền tảng | Expo app chạy được, navigation, theme, CI build | M0: App skeleton build EAS lên được TestFlight/Internal |
| P1 | Data & Catalogue 2D | API client, auth, danh sách phòng/hiện vật, chi tiết 2D | M1: Visitor duyệt catalogue + xem chi tiết offline |
| P2 | Media & Audio guide | Audio guide, hình ảnh, i18n 6 ngôn ngữ | M2: Nghe audio guide + đổi ngôn ngữ |
| P3 | 3D Engine | Render phòng 3D, model GLB, điều hướng camera touch | M3: Tham quan phòng 3D cơ bản trên thiết bị thật |
| P4 | Hotspot + Guided Tour + AR | Hotspot storytelling, guided tour, AR | M4: Full tương tác tương đương web |
| P5 | Hoàn thiện & phát hành | A11y, performance, offline, test E2E, store submission | M5: Build release nộp store |

## 2. Timeline (gợi ý)

```
Tuần:   1   2   3   4   5   6   7   8   9  10  11  12
P0     [=======]
P1             [=======]
P2                     [=======]
P3                             [=======]
P4                                     [=======]
P5                                             [=======]
```

Các phase nền tảng (P0, P1) tuần tự; P2–P4 có thể gối đầu một phần vì khác luồng (media vs 3D).

## 3. Definition of Ready (DoR) cho mỗi task

- Có AC rõ ràng, đo được.
- Phụ thuộc (dependency) đã xong hoặc đã mock.
- Thiết kế/Figma hoặc tham chiếu màn web tương ứng đã có.
- Dữ liệu test / endpoint sẵn sàng (hoặc fixture).

## 4. Definition of Done (DoD) cho mỗi task

- Code pass `lint` + `typecheck`.
- Có test đi kèm (unit/component tối thiểu cho logic; E2E cho luồng chính).
- Chạy được trên **cả iOS và Android** (simulator + ≥1 thiết bị thật).
- A11y: có label, focus order, contrast đạt với phần UI mới.
- PR nhỏ, có mô tả + bằng chứng (screenshot/clip), review ≥1 người, CI xanh.
- Cập nhật tài liệu liên quan nếu đổi contract/kiến trúc.

## 5. Quy trình Git

- Nhánh từ `dev`, đặt tên `feat/mob-<slug>` hoặc `chore/mob-<slug>`.
- Commit nhỏ, chi tiết; PR vào `dev`, merge sau review. Không merge thẳng `main`.
- Gắn task ID (`MOB-Exx-yy`) vào tiêu đề commit/PR.

## 6. Ceremonies

- Daily standup 15'; Sprint planning đầu phase; Review + Retro cuối phase.
- Demo trên thiết bị thật tại mỗi milestone.

## 7. Môi trường

- **Dev:** Expo Go / Dev Client, trỏ API staging.
- **Staging:** EAS build (internal distribution), API staging.
- **Prod:** EAS build submit store, API production.

## 8. Rủi ro lịch trình

- 3D/AR trên RN là hạng mục bất định cao nhất → bố trí spike sớm ở P0/P3 (xem `risk-assessment.md`).
- Phụ thuộc API: nếu cần endpoint mobile-specific (ví dụ: bundle offline) phải chốt sớm với team back-end.
