# Kế hoạch atomic commits

Mỗi commit chứa code và regression tests tương ứng đã chạy. SHA sẽ được integrator điền sau khi review toàn diff. Dùng một nhánh `feat/advanced-3d-asset-pipeline` và một PR vào `dev`.

| Thứ tự đề xuất | Nội dung | Focused verification | SHA |
| --- | --- | --- | --- |
| 1 | `docs(assets): document optimization architecture and gates` | Audit contract và file inventory | Pending |
| 2 | `feat(assets): add offline Draco LOD and WebP processing` | Package integration, source immutability, decode và metadata | Pending |
| 3 | `feat(museum): decode self-hosted Draco in shared GLB loader` | Legacy/Draco/Preview/public, decoder failures, abort/integrity | Pending |
| 4 | `feat(museum): integrate bounded screen-space LOD assets` | Selector, owner lifecycle, fallback, fixture browser | Pending |
| 5 | `docs(assets): record visual and benchmark evidence` | Actual results, missing coverage, source/build SHA | Pending |

Có thể gộp/tách khi diff thực có phụ thuộc hợp lý. Mọi commit cần thể hiện thay đổi thực và giữ trạng thái dùng được. Commit ledger cuối chỉ chứa SHA đã tồn tại.

PR hiện pending. Base phải là `dev`. Do shared loader liên quan validation untrusted assets và production derived publication cần review boundary, bàn giao tại PR cho người phụ trách review trước merge theo AGENTS.
