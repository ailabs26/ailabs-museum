# Kế hoạch Advanced 3D Asset Pipeline

Ngày 12/11/2026. Base `origin/dev` tại `dcbb814141bef3ed547f0893edb701c4d9407771`, nhánh `feat/advanced-3d-asset-pipeline`. Phạm vi offline/fixture đã được triển khai và kiểm chứng. Nghiệm thu tổng thể REVIEW_REQUIRED tại PR draft #186. Kết quả và các checkpoint nằm trong `verification.md` và `performance-report.md`.

## Phạm vi thực hiện

1. Audit luồng upload, inspection, storage, published delivery, CMS Preview và public scene trên base đã fetch.
2. Thêm package Node `tools/asset-pipeline/` với phiên bản thư viện cố định, CLI GLB Draco/LOD và WebP, manifest có SHA-256 và nguồn gốc, output tách biệt original.
3. Dùng chung parser Three.js có Draco decoder self-hosted cho public model và CMS Preview. Duy trì kiểm tra file và checksum public trước parse.
4. Thêm adapter LOD tùy chọn cho fixture đáng tin, nối trực tiếp vào `MuseumScene` và owner `RoomModelAssets`. Chọn bằng projected pixels và hysteresis, giữ model đang thấy trong lúc tải variant.
5. Chạy kiểm tra tự động, browser fixture có GLB thật được sinh từ dữ liệu tổng hợp, capture so sánh cùng điều kiện và thu metric có thể tái lập.
6. Review diff, tạo atomic commits theo thay đổi thực, bàn giao một PR vào `dev` khi điều kiện công cụ cho phép.

## Trách nhiệm theo file

| Phần | Owner triển khai | File chính | Bằng chứng cần có |
| --- | --- | --- | --- |
| Offline processing | Asset pipeline | `tools/asset-pipeline/` | Roundtrip decode, metadata, lỗi đầu vào, giữ original, WebP/LOD metrics |
| Draco runtime | Shared loader | `front-end/src/helpers/`, `front-end/src/shared/components/media/previewModel.ts`, decoder public assets | Legacy, Draco, decoder thiếu/hỏng, integrity, abort, parity Preview/public |
| Runtime LOD | Scene integration | `roomModelAssets.ts`, `useRoomModels.ts`, `MuseumScene.tsx`, helper LOD, tests/fixture | Screen pixels, hysteresis, dedupe, fallback, eviction, selection/focus |
| Audit và thiết kế | Tài liệu | Thư mục kế hoạch hiện tại | Contract source audit, quality protocol, report rõ coverage |
| Kiểm chứng và bàn giao | Integrator | Tests, evidence, commit ledger | Quality gates hiện tại và review toàn diff |

## Thứ tự và điều kiện hoàn tất

- Audit và thiết kế đi trước thay đổi tương ứng. Các phần offline và shared decoder có thể triển khai độc lập sau khi contract đã chốt.
- CLI ghi vào thư mục mới, giữ master bất biến. Mọi candidate bắt đầu ở `REVIEW_REQUIRED`, chỉ quyết định human QA có căn cứ mới được ghi `PASS`.
- Fixture LOD đi qua download, integrity, parse, sanitize, normalization và room lifecycle thực. Test phải chứng minh mỗi GLB được tải độc lập.
- Chạy frontend `typecheck`, `lint`, `test:unit`, `build` và Playwright liên quan. Chạy test package offline. Backend được audit read-only, kiểm tra backend bổ sung khi có thay đổi code backend.
- Đối chiếu ảnh, geometry và benchmark với cùng camera/renderer/workload. Số liệu chưa đo giữ trạng thái pending hoặc unavailable.

## Checkpoint người phụ trách

Production publication nhiều derived variants đang chờ thiết kế quan hệ original/derived và phê duyệt backend/database. Entity hiện tại chỉ biểu diễn một file cho mỗi media và một model slot cho mỗi revision. Quyền xem từng LOD phải suy từ original Published hiện hành. Bước này cần review contract, ownership, revocation, retention và migration trước triển khai.

Một GLB candidate đã được curator duyệt có thể được upload thành media riêng qua pipeline hiện có và gắn vào revision bằng workflow CMS hiện hành. Ghi provenance từ manifest khi bàn giao. Phần LOD production đa variant vẫn cần checkpoint trên.

## Giới hạn nghiệm thu cần theo dõi

Dataset hiện vật thật được cấp quyền, human visual review, Android/iOS/WebXR vật lý và benchmark thiết bị thực phụ thuộc tài nguyên sẵn có. Fixture tổng hợp chỉ chứng minh trường hợp đã chạy. Báo cáo cuối phải phân biệt rõ offline, runtime fixture và public delivery đã xác minh.
