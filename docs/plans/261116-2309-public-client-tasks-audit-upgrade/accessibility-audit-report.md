# Accessibility Audit Report — Giao diện Client (Public Portal)

- **Sản phẩm:** Aura Museum — Public Portal (React 18 + Vite + Mantine 7)
- **Chuẩn đối chiếu:** WCAG 2.2 Level AA
- **Ngày audit:** 2026-11-16
- **Người thực hiện:** Kỹ thuật (audit tự động + review code)
- **Phạm vi trang:** Trang chủ (`/`), Danh mục 2D (`/collection`), Chi tiết hiện vật 2D (`/collection/:room/exhibits/:id`), Guided Tour 2D
- **Trạng thái:** Audit tự động + review code **đã hoàn tất**. Kiểm thử screen reader trên **thiết bị thật (NVDA/VoiceOver) CHƯA CHẠY** — xem mục 6.

---

## 1. Phương pháp

| Lớp kiểm thử | Công cụ | Trạng thái |
|---|---|---|
| Tự động (DOM) | `@axe-core/playwright`, tags `wcag2a/2aa/21a/21aa/22aa` | ✅ Đã chạy — `tests/public-a11y-axe.spec.ts` |
| Điều hướng bàn phím | Playwright keyboard (`tests/accessibility-keyboard.spec.ts`, `accessibility-modal.spec.ts`) | ✅ Đã có & pass |
| Tương phản màu (sáng/tối) | axe + test focus-visible đa breakpoint (320/768/1440) | ✅ Đã có |
| Review code thủ công | Đọc component + ARIA | ✅ Đã làm |
| **Screen reader thiết bị thật** | **NVDA (Windows), VoiceOver (macOS/iOS)** | ❌ **CHƯA CHẠY** — cần phần cứng + người kiểm thử |

**Cách tái lập audit tự động:**
```bash
cd front-end
npx playwright test public-a11y-axe --reporter=line
# JSON chi tiết vi phạm đính kèm trong test-results/ (axe-<route>-<scheme>.json)
```

---

## 2. Kết quả audit tự động (axe-core)

> Lần chạy `public-a11y-axe.spec.ts` (4 route × 2 giao diện = 8 lượt quét) ngày 2026-11-16, Node 22.
> Evidence JSON đầy đủ: `./axe-evidence/axe-<route>-<scheme>.json`.

| Route | Light | Dark | Vi phạm |
|---|---|---|---|
| `/` (Trang chủ) | ✅ 0 | ✅ 0 | — |
| `/collection` | ❌ FAIL | ❌ FAIL | `color-contrast` (serious) |
| `/collection?room=sculpture` | ❌ FAIL | ❌ FAIL | `color-contrast` (serious) |
| Chi tiết 2D | ❌ FAIL | ❌ FAIL | `color-contrast` (serious) |

**Chỉ 1 loại vi phạm duy nhất: `color-contrast` (WCAG 1.4.3, mức serious).** Không có lỗi critical, không lỗi role/label/keyboard ở lớp tự động.

### Chi tiết lỗi contrast (nguyên nhân gốc: token `dimmed` của Mantine)

| Vị trí | Màu chữ | Màu nền | Tỉ lệ | Cần |
|---|---|---|---|---|
| `Text` dimmed sm (VisitorStorageStatus, RecentlyViewed) — light | `#868e96` | `#ffffff` | **3.32:1** | 4.5:1 |
| Nhãn nút action trên thẻ hiện vật (`variant=subtle compact-sm`) — light | `#868e96` | `#fff9f0` | **3.17:1** | 4.5:1 |
| Mô tả + "Ghi chú riêng" (visitor notes) — dark | `#828282` | `#242424` | **4.03:1** | 4.5:1 |

→ Khắc phục: nâng độ đậm token `dimmed` cho cả 2 giao diện ở nhánh `fix/a11y-wcag22-remediation`. Trang chủ không dính vì không dùng text dimmed trên nền sáng/thẻ.

---

## 3. Ma trận tiêu chí WCAG 2.2 AA (đánh giá qua review code)

| Tiêu chí | Mức | Đánh giá | Bằng chứng |
|---|---|---|---|
| 1.1.1 Non-text Content | A | ✅ Pass | `alt`/`aria-hidden` cho icon trang trí; `localizedAltText` cho ảnh hiện vật; fallback "Hình minh họa thay thế" |
| 1.3.1 Info and Relationships | A | ✅ Pass | `<section aria-labelledby>`, `<dl>` cho stats, heading phân cấp đúng (h1→h2→h3) |
| 1.4.3 Contrast (Minimum) | AA | ❌ **FAIL** | Text `dimmed` 3.17–4.03:1 (<4.5) trên collection + chi tiết 2D, cả light/dark — xem mục 2 |
| 1.4.10 Reflow | AA | ✅ Pass | Test `scrollWidth <= innerWidth` ở 320px; Mantine responsive |
| 1.4.11 Non-text Contrast | AA | ✅ Pass | Viền pill/nút, focus outline `solid` |
| 2.1.1 Keyboard | A | ✅ Pass | Toàn bộ điều hướng bằng phím (`accessibility-keyboard.spec.ts`) |
| 2.1.2 No Keyboard Trap | A | ✅ Pass | Panel chi tiết cho phép Tab thoát + khôi phục trigger |
| 2.4.1 Bypass Blocks | A | ✅ Pass | Skip-link "Đến nội dung chính" → `<main>` |
| 2.4.3 Focus Order | A | ✅ Pass | Thứ tự focus kiểm thử trong panel hotspot |
| 2.4.7 Focus Visible | AA | ✅ Pass | `outline-style: solid` kiểm thử đa breakpoint/scheme |
| 2.4.11 Focus Not Obscured (Minimum) | AA | 🟡 Cần xác nhận | Skip-link `toBeInViewport`; các vùng sticky khác chưa test riêng |
| 2.5.8 Target Size (Minimum) | AA | 🟡 **Cần kiểm tra** | WCAG 2.2 mới — một số nút icon/pill cần xác nhận ≥24×24px |
| 3.2.6 Consistent Help | A | ✅ Pass | Nút "Báo nội dung" nhất quán giữa các trang |
| 3.3.7 Redundant Entry | A | ✅ Pass | Không có form nhập lặp trong luồng public |
| 4.1.2 Name, Role, Value | A | ✅ Pass | `aria-pressed` (pill phòng, so sánh), `aria-label` nút icon |
| 4.1.3 Status Messages | AA | ✅ Pass | `role="status" aria-live="polite"` cho trạng thái tải/tour |

**Tiêu chí mới của WCAG 2.2 cần chú ý:** 2.4.11, 2.5.8 (Target Size), 3.2.6, 3.3.7 — xem mục 4.

---

## 4. Phát hiện & khuyến nghị

| # | Mức độ | Tiêu chí | Phát hiện | Khuyến nghị |
|---|---|---|---|---|
| **F1** | **Serious** | 1.4.3 Contrast | Token `dimmed` (#868e96 light / #828282 dark) đạt 3.17–4.03:1 trên collection + chi tiết 2D | **Nâng độ đậm `dimmed`**: light ≤ #6b7280, dark ≥ #a1a1a1 để ≥4.5:1; nhánh `fix/a11y-wcag22-remediation` |
| F2 | Trung bình | 2.5.8 Target Size | Nút icon (favorite, play) và pill phòng cần xác nhận vùng chạm ≥24px (WCAG 2.2 mới) | `min-height/min-width: 24px`; cùng nhánh remediation |
| F3 | Thấp | 4.1.2 (WebGL fallback) | Khi 3D tự rơi về 2D, thông báo screen reader có thể rõ hơn | Thêm `aria-live` announce khi fallback |

*Lỗi chính (Serious) là contrast — axe phát hiện, review code bỏ sót. Không có lỗi Critical. Các mặt khác (keyboard, landmark, status) đạt chuẩn.*

---

## 5. Điều hướng bàn phím (đã kiểm thử tự động)

- ✅ Skip-link hiển thị khi focus, Enter đưa focus vào `<main>` (320/768/1440px, light/dark).
- ✅ Panel chi tiết hotspot: Tab tuần tự, Shift+Tab, Escape đóng và khôi phục trigger.
- ✅ Thoát tour 3D → focus về nút điều khiển hợp lý.
- ✅ Sau hạn phục hồi WebGL thất bại → focus về heading `<h1>` của nội dung đọc được.

---

## 6. Screen reader — CHƯA CHẠY TRÊN THIẾT BỊ THẬT

> **Lưu ý minh bạch:** Môi trường audit tự động không điều khiển được screen reader phần cứng.
> Phần dưới là **checklist cần người kiểm thử thực hiện trên thiết bị thật** và điền kết quả.

| Kịch bản | NVDA (Win) | VoiceOver (macOS/iOS) | Kết quả |
|---|---|---|---|
| Đọc đúng heading cấu trúc Trang chủ (rotor/heading list) | ☐ | ☐ | _chưa chạy_ |
| Danh mục: thông báo "đang tải"/số hiện vật qua `aria-live` | ☐ | ☐ | _chưa chạy_ |
| Chi tiết 2D: đọc tên, phòng, mô tả, alt ảnh | ☐ | ☐ | _chưa chạy_ |
| Guided Tour: đọc trạng thái (chạy/tạm dừng/bước x/y) | ☐ | ☐ | _chưa chạy_ |
| Fallback WebGL→2D: thông báo lỗi mở 3D | ☐ | ☐ | _chưa chạy_ |
| Skip-link + landmark navigation | ☐ | ☐ | _chưa chạy_ |

**Hướng dẫn ngắn cho người kiểm thử:** bật NVDA → duyệt bằng phím Tab/H (heading)/D (landmark); VoiceOver (Cmd+F5) → dùng rotor (Ctrl+Opt+U). Ghi lại mọi chỗ đọc sai/thiếu nhãn vào bảng trên.

---

## 7. Kết luận

- **Phát hiện chính:** 1 lỗi Serious — `color-contrast` (1.4.3) ở token `dimmed` trên trang Collection + Chi tiết 2D (cả light/dark). Trang chủ sạch.
- **Bàn phím / landmark / status message:** đạt AA.
- **Việc còn lại:** (a) vá contrast `dimmed` + xác nhận Target Size 2.5.8 (nhánh `fix/a11y-wcag22-remediation`); (b) **chạy screen reader trên thiết bị thật** (mục 6) — ngoài khả năng tự động hoá, đánh dấu *chưa thực hiện*.
- Sau khi vá contrast, chạy lại `npx playwright test public-a11y-axe` để xác nhận 8/8 pass.
