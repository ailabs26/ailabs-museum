# Phân công 5 thành viên — Mobile Visitor App

> Dùng placeholder TV1–TV5. Điền tên thật vào cột "Tên" và trong file Excel `mobile-task-allocation.xlsx`.

## 1. Vai trò & phạm vi

| TV | Tên | Vai trò | Khối phụ trách chính | SP |
| --- | --- | --- | --- | --- |
| TV1 | _(điền)_ | Platform & Release Lead | Foundation (E1), Design tokens/layout (E2 phần), CI/CD & EAS, Release (E15), 2D fallback, OTA | 54 |
| TV2 | _(điền)_ | Data & Observability | Core data/http/auth (E3), Offline (E12), Observability (E13), Perf profiling | 52 |
| TV3 | _(điền)_ | Content UI & i18n | Catalogue/Rooms (E4), Exhibit detail & media (E5), i18n (E10), UI components, guided bar | 56 |
| TV4 | _(điền)_ | 3D & AR Engine | 3D engine (E6), AR (E9) | 55 |
| TV5 | _(điền)_ | Interaction, A11y & QA | Hotspot (E7), Guided tour logic (E8), A11y (E11), Testing harness & E2E (E14) | 56 |

Tổng 273 SP, trung bình 54.6/người, chênh lệch tối đa 4 SP.

## 2. Nguyên tắc chia

- **Theo luồng dọc (vertical slice)** để giảm phụ thuộc chéo: mỗi người sở hữu trọn một khối tính năng từ data → UI → test của khối đó.
- **Tách rủi ro:** 3D (TV4) và AR (TV4) gom một người chuyên sâu; interaction/QA (TV5) gom người khác. Khi spike AR, TV5/TV3 hỗ trợ chéo vì ít phụ thuộc giai đoạn đầu.
- **Mỗi người tự viết test cho phần mình**; TV5 sở hữu E2E harness chung.

## 3. Ma trận phụ thuộc chéo quan trọng

| Phụ thuộc | Người cung cấp | Người tiêu thụ | Rủi ro |
| --- | --- | --- | --- |
| http-client + query (E3) | TV2 | TV3, TV4, TV5 | Cao — cần xong sớm P1 |
| File cache (E3-05) | TV2 | TV4 (GLB), TV3 (audio) | Cao |
| Render phòng (E6-04) | TV4 | TV5 (hotspot, tour) | Cao — chặn P4 |
| Helper port (normalization, hotspot, path) | TV3/TV5 | TV4 | Trung bình |
| Design tokens/components (E2) | TV1/TV3 | Tất cả | Trung bình |

## 4. Lịch theo phase (ai làm gì khi)

| Phase | TV1 | TV2 | TV3 | TV4 | TV5 |
| --- | --- | --- | --- | --- | --- |
| P0 | E1, E2 tokens | (hỗ trợ E3 chuẩn bị) | E2 components | E6-01 spike | E14 chuẩn bị |
| P1 | EAS, OTA | E3 core | E4 catalogue | E6 nền | (port helper) |
| P2 | layout, fallback | E12 nền | E5 media, E10 i18n | E6 tiếp | E7 port helper |
| P3 | — | E11-03 perf | E6-03 port | E6-04..08 | E8-01 port |
| P4 | E9-04 | E12 | E8-03 bar | E9 AR | E7, E8 |
| P5 | E15 release | E13 obs, E12 | E14-03 | — | E11, E14 |

## 5. Cân bằng & linh hoạt

- Nếu TV4 (3D/AR) trượt tiến độ do rủi ro kỹ thuật → rút E6-08/E9-03 ra khỏi MVP, phân bổ lại.
- Nếu TV2 xong E3 sớm → hỗ trợ TV4 phần cache GLB.
- Review chéo: mỗi PR cần ≥1 reviewer khác khối để lan tỏa hiểu biết.

## 6. Câu hỏi mở

- Tên thật & mức kinh nghiệm từng thành viên (ảnh hưởng ai nhận khối 3D/AR rủi ro cao).
- Có ai từng làm RN/3D/AR chưa? Nếu chưa, cộng buffer học tập cho TV4.
