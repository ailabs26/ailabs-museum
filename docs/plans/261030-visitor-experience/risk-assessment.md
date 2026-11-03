# Rủi ro và rollback

| Rủi ro | Kiểm soát | Rollback |
|---|---|---|
| Quota/disabled/corrupt storage | strict schema/version/size, try/catch, RAM fallback + honest status | Revert feature hoặc persistence commit sau khi revert consumers; keys v1 không ảnh hưởng hệ thống khác |
| Snapshot cũ làm lộ nội dung đã ẩn | Không lưu DTO; resolve room list + room validated; query lỗi không render cache cũ | Revert resolver consumer |
| Query bùng nổ | Chỉ tải các phòng có ref, dedupe query keys; 20 recent/3 compare | Revert recent/compare |
| Cross-tab/đổi route nhanh | Latest storage read, sync update, subscribed event cleanup; notes key theo room/exhibit | Revert notes commit; dữ liệu local giữ nguyên |
| Shared grid ảnh hưởng home | Prop action slot optional; existing markup/links giữ | Revert grid consumer và prop |
| Modal/focus/mobile | Mantine Modal, semantic labels, keyboard tests, horizontal area có nhãn | Revert compare |
| PR #130 | Chỉ backend; không đổi API/search contract | Không merge/rebase tự động nếu remote thay đổi xung đột |
| Memo correction | Baseline lint warning làm evidence; sort/filter regression | Revert focused memo commit |

Không đụng backend, migration/schema/seed/data, auth/RBAC/audit, CMS, 3D camera/render/XR, CI/env/deployment. Không chạy API ghi hoặc seed. Tính riêng tư: notes chỉ browser, không analytics; người dùng chia sẻ trình duyệt có thể đọc dữ liệu này. Handoff cần review UI/a11y trên thiết bị thật.
