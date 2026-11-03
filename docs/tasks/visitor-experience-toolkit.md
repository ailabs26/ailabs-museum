# Visitor Experience Toolkit

Nhánh `feat/visitor-experience-toolkit`, base `a959185`; đề bài người dùng 30/10/2026.
Kế hoạch: [visitor-experience](../plans/261030-visitor-experience/plan.md).
Kiểm chứng: [verification](../plans/261030-visitor-experience/verification.md).

- [x] Favorites cục bộ, filter trong phòng.
- [x] Recently viewed + tiếp tục khám phá.
- [x] So sánh 2–3 hiện vật 2D.
- [x] Chế độ đọc scoped.
- [x] Ghi chú riêng autosave.
- [x] Fix memo có baseline lint evidence.
- [x] Unit/browser/quality gates, independent review và bàn giao.

Không backend/database/CMS/XR; không push/PR/merge. PR #130 search backend đang draft/open, không giao file.

Kết quả cuối: typecheck/lint/build PASS; unit194/194; production browser99/99 (21 mới +78 hiện có). Ba browser failures khác đã tái hiện nguyên trên origin/dev và ghi tại verification, không được tính PASS. Bàn giao: [handoff](../plans/261030-visitor-experience/handoff.md).
