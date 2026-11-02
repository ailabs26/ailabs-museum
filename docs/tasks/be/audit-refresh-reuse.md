# Task: Ghi audit khi phát hiện tái dùng refresh token

Người phụ trách: Nguyễn Văn Thắng. Nhánh `feat/audit-refresh-reuse`.

## Bối cảnh

`TokenService.rotate` đã có reuse-detection: nếu token đã xoay vòng bị gửi lại thì thu hồi cả family. Nhưng mọi nhánh lỗi
đều trả `null` rồi ném 401 chung, nên controller không biết đó là ca bị đánh cắp và không có dấu vết gì để Admin điều tra.

## Thay đổi

- `RefreshFailedException` (kế thừa `UnauthorizedException`, cùng thông điệp chung) mang `reason`, `userId`, `familyId`.
  `reason` gồm `unknown_token` | `reuse` | `revoked` | `expired` | `inactive_user`.
- `rotate` trả exception có lý do thay vì `null`, vẫn ném **sau commit** để việc revoke không bị rollback. Ca `usedAt`
  (token đã xoay vòng) là `reuse`; ca chỉ có `revokedAt` là `revoked` vì đó là chuyện bình thường (đăng xuất từ xa rồi cookie
  cũ gửi lại), không tính là tấn công.
- `AuthController.refresh`: khi `reason === 'reuse'` thì ghi `auth.refresh_reuse_detected` (actor null, `resourceId` = chủ
  phiên, `reason` = `{"familyId": …}`, kèm IP/UA/request id). Client vẫn nhận 401 như cũ và cookie bị xóa.
- Cập nhật `docs/architecture/05-security-rbac.md` và `06-api-contract.md`.

## Kiểm chứng ngày 02/11/2026

- Back-end: lint, typecheck đạt; `npm test` 1996/1996.
- `token-service.spec.ts`: mỗi nhánh lỗi của `rotate` mang đúng `reason`. Đặc biệt, sau khi family bị thu hồi do reuse,
  token mới (chưa dùng) gửi lên ra `revoked` chứ không phải `reuse`.
- `auth-audit.spec.ts` (HTTP): `reuse` → đúng 1 bản ghi `auth.refresh_reuse_detected` với chủ phiên + family + UA, thông
  điệp 401 chung, cookie bị xóa; `revoked` / `expired` / `inactive_user` / `unknown_token` → không ghi.
