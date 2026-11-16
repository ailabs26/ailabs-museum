# Plan: Audit & Nâng cấp 6 task Giao diện Client (Public Portal)

- **Ngày:** 2026-11-16
- **Nhánh gốc:** `dev`
- **Phạm vi:** 6 task public-client người dùng liệt kê
- **Kết luận nhanh:** Cả 6 task **đã có hiện thực nền tảng đầy đủ và có test**. Đây là việc *audit + nâng cấp bổ sung*, không phải build mới. Có **2 khoảng trống thật**, còn lại là polish.

---

## 1. Hiện trạng từng task (đã kiểm chứng qua code)

| # | Task | Trạng thái | Bằng chứng trong repo |
|---|------|-----------|------------------------|
| 1 | Trang chủ + Danh mục BST 2D (≥5 hiện vật, nối API) | ✅ **Hoàn thiện** | `pages/client/HomePage.tsx` (hero + bento + featured), `HomeFeaturedExhibits.tsx`, `CollectionPage.tsx` (rooms/search/filter/favorites/compare qua `useMuseumRooms` → API) |
| 2 | Chi tiết hiện vật 2D + fallback mượt 3D→2D khi lỗi WebGL | ✅ **Hoàn thiện** | `ExhibitDetailPage.tsx`; máy trạng thái 4 bước `helpers/webglRecovery.ts` (ready/recovering/verifying/failed), `webglRenderGuard.ts`, `webglSupport.ts` — đều có `.test.ts` |
| 3 | Audit WCAG 2.2 AA thiết bị thật (NVDA/VoiceOver + phím) + **bàn giao report** | ⚠️ **Thiếu deliverable** | Code đã a11y tốt (aria-live, role, focus mgmt, VisuallyHidden). Có `docs/plans/accessibility-checklist.md` + plan keyboard/modal/loading, **nhưng chưa có "Accessibility Audit Report" chính thức** với kết quả screen reader/phím trên thiết bị thật |
| 4 | Asset 3D Pipeline: Draco + LOD + WebP | ✅ **Hoàn thiện (rất kỹ)** | `tools/asset-pipeline/` (geometry/images/optimizer + test), `docs/plans/261112-advanced-3d-asset-pipeline/` (draco/lod/webp-design + performance-report + verification). FE: `dracoMemory`, `modelLod`, `roomModelLods`, `glbAsset` — đều có test |
| 5 | Guided Tour UI (Bắt đầu/Tạm dừng/Tiếp/Thoát) đồng bộ 2D↔3D | ✅ **Hoàn thiện** | `components/museum/GuidedTour2DControls.tsx`, `hooks/useGuidedTour2D`, `helpers/guidedTour2dNavigation.ts` (nối 3D path), `docs/tasks/guided-tour-mode-sync.md` |
| 6 | i18n UI đa ngôn ngữ + Transcript/Phụ đề đồng bộ audio | 🟡 **UI xong, phụ đề giới hạn** | UI 6 ngôn ngữ (vi/en/fr/zh/ko/ja) qua `translations.service.ts` + `publicLocale.ts`. **Nhưng media slot chỉ có `audioVi/audioEn` + `subtitleVi/subtitleEn`** → transcript/phụ đề chỉ VI/EN; 4 ngôn ngữ còn lại thiếu phụ đề |

---

## 2. Khoảng trống thật & đề xuất nâng cấp

### 🔴 Gap A — Accessibility Audit Report (Task 3) — *ưu tiên cao*
Task yêu cầu rõ "bàn giao accessibility audit report". Hiện chỉ có checklist/plan rời.
**Đề xuất:**
- A1. Chạy audit tự động (axe-core / Playwright + `@axe-core/playwright`) trên các trang public chính (Home, Collection, ExhibitDetail, Tour 2D).
- A2. Soạn **báo cáo audit WCAG 2.2 AA** chuẩn: phạm vi, phương pháp, ma trận tiêu chí AA (pass/fail), kết quả screen reader (NVDA/VoiceOver), điều hướng phím, danh sách phát hiện + mức độ + khuyến nghị.
- A3. Vá các lỗi a11y phát hiện được (nếu có): skip-link, contrast, focus trap, target size 24px (WCAG 2.2 mới).

### 🟡 Gap B — Phụ đề/transcript đa ngôn ngữ (Task 6) — *ưu tiên trung bình*
Hiện phụ đề chỉ VI/EN. UI hỗ trợ 6 ngôn ngữ → khách FR/ZH/KO/JA không có phụ đề.
**Đề xuất (chọn 1):**
- B1 (nhẹ, khuyến nghị): Thêm **fallback phụ đề có thông báo** — khi ngôn ngữ UI không có phụ đề, hiển thị phụ đề nguồn (VI) + nhãn "phụ đề gốc" + đồng bộ audio; đảm bảo không vỡ UI.
- B2 (nặng): Mở rộng schema media slot thêm subtitle cho 4 ngôn ngữ (đụng BE entity + migration + CMS upload) — *ngoài phạm vi client, cần quyết định riêng*.

### 🟢 Polish (tùy chọn, thấp)
- P1 (Task 1): SEO/OpenGraph meta cho Home & ExhibitDetail (chia sẻ mạng xã hội).
- P2 (Task 5): Phím tắt bàn phím cho Guided Tour (←/→/Space/Esc) + `aria-keyshortcuts`.
- P3 (Task 2): Thông báo trạng thái fallback WebGL rõ hơn cho screen reader khi tự rơi về 2D.

---

## 3. Chiến lược nhánh & PR (nhánh từ `dev`, PR về `dev`)

Mỗi nhánh = 1 nhóm việc độc lập, commit nhỏ & chi tiết:

| Nhánh | Nội dung | Gap |
|-------|----------|-----|
| `chore/public-client-audit-report` | Audit tự động + Accessibility Audit Report (docs) | A1–A2 |
| `fix/a11y-wcag22-remediation` | Vá lỗi a11y + target size 24px + skip-link | A3, P2, P3 |
| `feat/multilingual-subtitle-fallback` | Fallback phụ đề đa ngôn ngữ có nhãn | B1 |
| `feat/public-seo-metadata` | OpenGraph/SEO meta (tùy chọn) | P1 |

Mỗi nhánh → 1 PR riêng về `dev` (dễ review, đúng quy ước Git của dự án).

## 4. Rủi ro / Câu hỏi mở
- Audit thiết bị thật NVDA/VoiceOver cần phần cứng thật — phần tự động hoá (axe) chạy được ngay; phần SR thủ công cần người dùng xác nhận hoặc ghi "chưa chạy trên thiết bị thật".
- Gap B2 (mở rộng schema phụ đề) đụng back-end + migration → cần quyết định trước khi làm.
- Chạy `npm run typecheck` + `npm run test` + `npm run lint` (front-end) trước mỗi PR.
