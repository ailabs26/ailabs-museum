# WBS chi tiết — Mobile Visitor App

**Quy ước:** SP = Story Point (Fibonacci). Owner = thành viên (TV1–TV5, xem `team-allocation.md`). Dep = phụ thuộc. AC = tiêu chí nghiệm thu rút gọn.

Tổng: **15 epic · 71 task · 273 SP**. Phân bổ cân bằng theo SP: TV1=54, TV2=52, TV3=56, TV4=55, TV5=56 (số task lệch 9–18 do task 3D/AR của TV4 nặng hơn — chia đều theo **khối lượng SP**, không theo số lượng task).

---

## E1 — Project Foundation & Tooling (Phase P0)

| ID | Task | SP | Owner | Dep | AC |
| --- | --- | --- | --- | --- | --- |
| MOB-E1-01 | Khởi tạo Expo app (TS strict) + chốt monorepo/workspace `shared/` | 5 | TV1 | — | `expo start` chạy; `front-end` & `mobile` import được `shared` |
| MOB-E1-02 | ESLint + Prettier kế thừa config web | 2 | TV1 | E1-01 | `lint` xanh, rule đồng bộ web |
| MOB-E1-03 | expo-router skeleton (Tabs + Stack lồng) | 3 | TV1 | E1-01 | Điều hướng 4 tab + stack demo |
| MOB-E1-04 | App config, env dev/staging/prod, icon/splash | 3 | TV1 | E1-01 | Đổi env qua build profile; icon/splash hiển thị |
| MOB-E1-05 | EAS Build iOS + Android (internal) | 5 | TV1 | E1-04 | Build thành công cả 2 nền tảng |
| MOB-E1-06 | EAS Submit + tài khoản/provisioning store | 5 | TV1 | E1-05 | Nộp được TestFlight + Play internal |
| MOB-E1-07 | EAS Update (OTA) channel setup | 2 | TV1 | E1-05 | Push OTA tới build internal |

## E2 — Design System & Shared UI (P0–P1)

| ID | Task | SP | Owner | Dep | AC |
| --- | --- | --- | --- | --- | --- |
| MOB-E2-01 | Theme tokens (màu/typography/spacing) từ web | 3 | TV1 | E1-01 | Token khớp brand web |
| MOB-E2-02 | Core components: Button, Text, Card, Stack | 3 | TV3 | E2-01 | Có test render + a11y role |
| MOB-E2-03 | Feedback: Loading, Error, Empty, Toast | 3 | TV3 | E2-01 | Dùng chung mọi màn |
| MOB-E2-04 | Layout: SafeArea, Header, TabBar custom | 2 | TV1 | E1-03 | An toàn notch/insets |
| MOB-E2-05 | Dark mode + reduced motion tokens | 2 | TV1 | E2-01 | Theo cài đặt OS |

## E3 — Data & Core (P1)

| ID | Task | SP | Owner | Dep | AC |
| --- | --- | --- | --- | --- | --- |
| MOB-E3-01 | axios http-client + unwrap `ApiResponse`/`Paginated` + error normalize | 5 | TV2 | E1-01 | Gọi API staging, lỗi chuẩn hóa |
| MOB-E3-02 | TanStack Query + persist offline (AsyncStorage) | 5 | TV2 | E3-01 | Query cache sống qua restart |
| MOB-E3-03 | Auth store (secure-store) + JWT access/refresh interceptor | 5 | TV2 | E3-01 | Tự refresh khi 401; logout sạch |
| MOB-E3-04 | Config/env module + feature flags | 2 | TV2 | E1-04 | Flag bật/tắt tính năng |
| MOB-E3-05 | File cache service (expo-file-system) cho GLB/audio | 5 | TV2 | E3-01 | Tải 1 lần, đọc lại từ cache |
| MOB-E3-06 | Media/image cache policy + quản lý dung lượng | 3 | TV2 | E3-05 | Giới hạn & dọn cache |

## E4 — Catalogue & Rooms (P1)

| ID | Task | SP | Owner | Dep | AC |
| --- | --- | --- | --- | --- | --- |
| MOB-E4-01 | roomsApi + hooks useRooms/useRoom | 3 | TV3 | E3-02 | Trả danh sách phòng/phòng chi tiết |
| MOB-E4-02 | Màn Danh sách phòng | 3 | TV3 | E4-01, E2-02 | List phòng, chọn vào |
| MOB-E4-03 | Màn Catalogue hiện vật (list + thumbnail) | 5 | TV3 | E4-01 | Ảnh lazy, cuộn mượt |
| MOB-E4-04 | Port `mapRoomDisplays` + fixtures + tests | 3 | TV3 | E3-01 | Test pass như web |
| MOB-E4-05 | Deep link phòng/hiện vật (expo-router) | 3 | TV3 | E1-03 | Mở app từ link tới đúng màn |

## E5 — Exhibit Detail & Media (P2)

| ID | Task | SP | Owner | Dep | AC |
| --- | --- | --- | --- | --- | --- |
| MOB-E5-01 | Màn chi tiết hiện vật 2D (title, mô tả, ảnh) | 5 | TV3 | E4-03 | Hiển thị đủ nội dung, cuộn |
| MOB-E5-02 | Audio guide player (expo-av) + điều khiển + locale | 5 | TV3 | E3-05 | Play/pause/seek; đổi locale đổi track |
| MOB-E5-03 | Image viewer/zoom + alt text a11y | 3 | TV3 | E5-01 | Pinch-zoom; alt đọc được |
| MOB-E5-04 | Content report form + submit (auth) | 3 | TV3 | E3-03 | Gửi report thành công khi đăng nhập |

## E6 — 3D Engine (P3)

| ID | Task | SP | Owner | Dep | AC |
| --- | --- | --- | --- | --- | --- |
| MOB-E6-01 | Spike r3f/native + expo-gl render 1 cube | 3 | TV4 | E1-01 | Cube xoay 60fps trên thiết bị thật |
| MOB-E6-02 | Load GLB qua expo-three + cache | 5 | TV4 | E6-01, E3-05 | 1 hiện vật hiển thị từ cache |
| MOB-E6-03 | Port model normalization helper + tests | 3 | TV3 | E6-02 | Test khớp web |
| MOB-E6-04 | Render phòng + nhiều hiện vật (gallery slots) | 8 | TV4 | E6-02 | Cả phòng hiển thị đúng vị trí |
| MOB-E6-05 | Camera controller touch (port `museumNavigation`) | 8 | TV4 | E6-04 | Xoay/di chuyển mượt bằng chạm |
| MOB-E6-06 | Va chạm + navigation path trong phòng | 5 | TV4 | E6-05 | Không xuyên tường/hiện vật |
| MOB-E6-07 | 2D fallback khi GLB/WebGL lỗi | 3 | TV1 | E6-02 | Lỗi 3D vẫn đọc nội dung |
| MOB-E6-08 | Chất lượng 3D theo thiết bị (perf tiers) | 5 | TV4 | E6-04 | Máy yếu giảm chất lượng, vẫn chạy |

## E7 — Hotspot Storytelling (P4)

| ID | Task | SP | Owner | Dep | AC |
| --- | --- | --- | --- | --- | --- |
| MOB-E7-01 | Port `hotspotStory` + `artifactHotspots` + tests | 3 | TV5 | E6-04 | Test pass như web |
| MOB-E7-02 | Marker hotspot 3D + chạm chọn | 5 | TV5 | E7-01 | Chạm marker chọn đúng điểm |
| MOB-E7-03 | Panel story (prev/next, progress, ARIA live) | 5 | TV5 | E7-02 | Duyệt điểm, đọc tiến độ |
| MOB-E7-04 | Camera focus tới hotspot (port `getGuidedView`) | 5 | TV5 | E7-02, E6-05 | Camera lia tới điểm, không chắn |
| MOB-E7-05 | Haptic + reduced motion khi chọn hotspot | 2 | TV5 | E7-02 | Rung nhẹ; tôn trọng reduced motion |

## E8 — Guided Tour (P4)

| ID | Task | SP | Owner | Dep | AC |
| --- | --- | --- | --- | --- | --- |
| MOB-E8-01 | Port `guidedCameraPath` + `buildGuidedPath` + tests | 5 | TV5 | E6-06 | Test path an toàn như web |
| MOB-E8-02 | `useGuidedCameraTour` hook (RN) | 5 | TV5 | E8-01 | Tour chạy qua các bước |
| MOB-E8-03 | Guided tour bar UI (play/pause/next/exit) | 3 | TV3 | E8-02 | Điều khiển đầy đủ, a11y |
| MOB-E8-04 | Đồng bộ tour ↔ chọn hiện vật/hotspot | 3 | TV5 | E8-02, E7-03 | Chọn hotspot tạm dừng tour đúng bước |

## E9 — AR (P4)

| ID | Task | SP | Owner | Dep | AC |
| --- | --- | --- | --- | --- | --- |
| MOB-E9-01 | Spike AR lib (react-viro) iOS+Android | 8 | TV4 | E1-05 | Đặt 1 model AR trên cả 2 OS |
| MOB-E9-02 | Đặt model hiện vật lên mặt phẳng + xoay/zoom | 8 | TV4 | E9-01, E6-02 | Thao tác ổn định |
| MOB-E9-03 | Hotspot overlay trong AR | 5 | TV4 | E9-02, E7-01 | Chạm hotspot trong AR |
| MOB-E9-04 | Thoát AR + khôi phục trạng thái app | 3 | TV1 | E9-02 | Về màn trước nguyên trạng |

## E10 — i18n & Localization (P2)

| ID | Task | SP | Owner | Dep | AC |
| --- | --- | --- | --- | --- | --- |
| MOB-E10-01 | Trích i18n messages chung (JSON) + loader | 3 | TV3 | E1-01 | 6 ngôn ngữ dùng chung web |
| MOB-E10-02 | i18next setup + đổi ngôn ngữ runtime | 3 | TV3 | E10-01 | Đổi ngôn ngữ không cần restart |
| MOB-E10-03 | Format số/ngày theo locale + kiểm RTL | 2 | TV3 | E10-02 | Định dạng đúng theo locale |

## E11 — A11y & Performance (P5)

| ID | Task | SP | Owner | Dep | AC |
| --- | --- | --- | --- | --- | --- |
| MOB-E11-01 | A11y audit: labels, focus, contrast, target size | 5 | TV5 | E5-01 | Màn chính đạt WCAG 2.2 AA |
| MOB-E11-02 | Screen reader (VoiceOver/TalkBack) luồng chính | 5 | TV5 | E11-01 | Đọc được toàn luồng visitor |
| MOB-E11-03 | Perf: bundle, startup, memory 3D profiling | 5 | TV2 | E6-04 | Đạt ngưỡng startup/memory đề ra |
| MOB-E11-04 | Giảm motion toàn app theo OS | 2 | TV1 | E2-05 | Tắt animation khi OS yêu cầu |

## E12 — Offline & Resilience (P5)

| ID | Task | SP | Owner | Dep | AC |
| --- | --- | --- | --- | --- | --- |
| MOB-E12-01 | Offline catalogue (persist) + banner trạng thái | 3 | TV2 | E3-02 | Mất mạng vẫn xem catalogue đã tải |
| MOB-E12-02 | Prefetch phòng để dùng offline onsite | 5 | TV2 | E3-05 | Tải trước 1 phòng dùng offline |
| MOB-E12-03 | Retry/backoff + error boundary toàn cục | 3 | TV2 | E3-01 | Lỗi mạng không crash |
| MOB-E12-04 | Quản lý dung lượng cache + xóa | 3 | TV2 | E3-06 | Xem & xóa cache trong Settings |

## E13 — Observability (P5)

| ID | Task | SP | Owner | Dep | AC |
| --- | --- | --- | --- | --- | --- |
| MOB-E13-01 | Sentry crash reporting | 3 | TV2 | E1-05 | Crash gửi về Sentry |
| MOB-E13-02 | Analytics sự kiện ẩn danh (phòng/hiện vật/tour) | 3 | TV2 | E3-04 | Sự kiện ghi nhận, không lộ PII |
| MOB-E13-03 | Log API lỗi tập trung | 2 | TV2 | E3-01 | Lỗi API tổng hợp được |

## E14 — Testing (P5, xuyên suốt)

| ID | Task | SP | Owner | Dep | AC |
| --- | --- | --- | --- | --- | --- |
| MOB-E14-01 | Jest + RNTL setup + CI gate | 3 | TV1 | E1-02 | Test chạy trong CI |
| MOB-E14-02 | Maestro E2E harness + smoke flow | 5 | TV5 | E4-02 | Smoke chạy CI/local |
| MOB-E14-03 | E2E: catalogue → detail → audio | 3 | TV3 | E5-02, E14-02 | Luồng pass |
| MOB-E14-04 | E2E: 3D → hotspot → guided tour | 5 | TV5 | E8-04, E14-02 | Luồng pass |
| MOB-E14-05 | Device test matrix (iOS/Android thật) | 3 | TV5 | E1-05 | Ma trận thiết bị có bằng chứng |

## E15 — Release & Store (P5)

| ID | Task | SP | Owner | Dep | AC |
| --- | --- | --- | --- | --- | --- |
| MOB-E15-01 | Store metadata, screenshots, privacy manifest | 3 | TV1 | E1-06 | Hồ sơ store đầy đủ |
| MOB-E15-02 | TestFlight build + internal testers | 3 | TV1 | E1-06 | Tester cài được |
| MOB-E15-03 | Play Internal testing build | 3 | TV1 | E1-06 | Tester cài được |
| MOB-E15-04 | Release checklist + rollback/OTA plan | 2 | TV1 | E15-02, E15-03 | Checklist ký duyệt |

---

## Tổng hợp SP theo thành viên

| Thành viên | Vai trò | SP |
| --- | --- | --- |
| TV1 | Platform & Release | 54 |
| TV2 | Data & Observability | 52 |
| TV3 | Content UI & i18n | 56 |
| TV4 | 3D & AR Engine | 55 |
| TV5 | Interaction, A11y & Testing | 56 |
| **Tổng** | | **273** |

> Chênh lệch tối đa 4 SP (~7%) — coi là chia đều. 3D/AR (TV4) và Interaction/Testing (TV5) là khối rủi ro cao; có thể cần hỗ trợ chéo khi spike AR.
