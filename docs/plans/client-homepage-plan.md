# Trang chủ Aura Museum — Implementation Plan

> **For agentic workers:** Dùng skill `executing-plans` để thực hiện và kiểm chứng từng task trong phiên hiện tại. Checklist phản ánh trạng thái đã quan sát; không đánh dấu hoàn thành chỉ dựa trên ý định.

**Goal:** Hoàn thiện phần nội dung tĩnh của trang chủ `/`, để trống vùng hiện vật nổi bật theo yêu cầu.

**Architecture:** `PublicLayout()` cung cấp header, main và footer cho route public. `HomePage()` cung cấp nội dung trang chủ; CSS Module của layout giữ palette riêng cho public, CSS Module của page quản lý bố cục. Không thêm state, service hoặc data fetching.

**Tech Stack:** React 18, TypeScript, Vite, Mantine 7, React Router 6, Tabler icons; Edge qua Playwright CLI để kiểm chứng runtime.

Task nguồn: [client-homepage.md](../tasks/client-homepage.md).

## Global Constraints

- Base: `origin/dev` tại `1ee2f41`; nhánh duy nhất `feat/client-homepage`.
- Theo `front-end/docs/coding-conventions.md`: named export, alias `@/`, CSS Module cùng tên component.
- Nền kem, điểm nhấn teal; responsive và light/dark.
- Hiện vật nổi bật để trống, không dữ liệu hardcode, skeleton tải giả hoặc API nội dung.
- Tham quan 3D ghi rõ `Sắp ra mắt`; danh mục `/collection` vẫn thuộc lượt phát triển tiếp theo.
- Không thêm dependency, không thay đổi theme admin, backend hoặc database.
- Commit, push và tạo PR chỉ khi người dùng yêu cầu; PR nhiệm vụ vào `dev`.
- Không thêm bộ test mới cho nội dung tĩnh này; dùng các quality gate hiện có và assertions trình duyệt.

## File map

| File | Trách nhiệm |
|---|---|
| `front-end/src/layouts/PublicLayout.tsx` | Landmark, logo, navigation, skip link và footer |
| `front-end/src/layouts/PublicLayout.module.css` | Palette public, focus và layout responsive |
| `front-end/src/pages/client/HomePage.tsx` | Hero, giới thiệu và mục nổi bật trống |
| `front-end/src/pages/client/HomePage.module.css` | Typography, bố cục và minh họa kiến trúc trang trí |
| `front-end/index.html` | Title, description và favicon |

---

## HOME-01: Public layout và điều hướng

**Files:** sửa `PublicLayout.tsx`; tạo `PublicLayout.module.css` theo file map.

**Interfaces:** consumes `Outlet` của router và logo `@/assets/aura-mark.svg`; produces named export `PublicLayout(): JSX.Element`, main `id="public-content"`, navigation và footer dùng được trên mọi route public.

- [x] **Bước 1 — Dựng landmarks và skip link.** Dùng cấu trúc:

```tsx
<a href="#public-content">Đến nội dung chính</a>
<header>{/* Logo và navigation */}</header>
<main id="public-content" tabIndex={-1}><Outlet /></main>
<footer>{/* Thông tin dự án và liên kết */}</footer>
```

- [x] **Bước 2 — Thêm điều hướng semantic.** Dùng `NavLink` với `to="/" end` và `to="/collection"`; đặt `aria-label="Điều hướng chính"` trên nav. Tham quan 3D là text `Sắp ra mắt`, không link hoạt động.
- [x] **Bước 3 — Style public riêng.** Khai báo `--public-background`, `--public-surface`, `--public-ink`, `--public-muted`, `--public-border`, `--public-accent` trên layout; override bằng selector `[data-mantine-color-scheme='dark']`. Focus có outline; header/footer chuyển bố cục theo viewport.
- [x] **Bước 4 — Kiểm chứng.** Tab đầu tiên tới skip link; Enter chuyển focus tới main. Logo trở về `/`, link bộ sưu tập tới `/collection`. Assertions đã chạy đạt trong phiên triển khai.

## HOME-02: Nội dung trang chủ và metadata

**Files:** sửa `HomePage.tsx`, `index.html`; tạo `HomePage.module.css`.

**Interfaces:** consumes palette của `PublicLayout`, `Button`, `Container`, `Title` và `Link`; produces named export `HomePage(): JSX.Element`, CTA tới `/collection`, một h1 và vùng nổi bật chưa có dữ liệu.

- [x] **Bước 1 — Hero.** Tiêu đề `Mỗi hiện vật, một câu chuyện.`, đoạn giới thiệu nghệ thuật/di sản, nút `Khám phá bộ sưu tập` và text `Tham quan 3D · Sắp ra mắt`.
- [x] **Bước 2 — Giới thiệu bảo tàng.** H2 `Không gian số. Kết nối thật.`, nội dung tiếng Việt và link tới `/collection`. Minh họa kiến trúc CSS dùng `aria-hidden="true"`, không đại diện cho hiện vật thật.
- [x] **Bước 3 — Vùng nổi bật.** Giữ h2 `Hiện vật nổi bật` và vùng trống không focusable, không thẻ mẫu. Không thêm service/hook/schema API trong task này.
- [x] **Bước 4 — Metadata.** Title `Aura Museum — Nghệ thuật và di sản`, description giới thiệu bảo tàng; favicon `/src/assets/aura-mark.svg` do Vite xử lý khi build.
- [x] **Bước 5 — Kiểm chứng nội dung.** Một h1; h2 theo thứ tự; CTA hoạt động; không có request `/api/rooms`. Assertions runtime đã chạy đạt, không có chu kỳ RED/GREEN trước triển khai.

## HOME-03: Quality gates và kiểm chứng runtime

**Files:** toàn bộ file map; cập nhật bằng chứng trong task và plan.

**Interfaces:** consumes ứng dụng frontend đã dựng; produces kết quả typecheck/lint/build và bằng chứng điều hướng/responsive.

- [x] **Bước 1 — Chạy quality gates từ `front-end/`.**

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Kết quả trong phiên triển khai: cả ba đạt; build có cảnh báo bundle lớn hơn 500 kB.

- [x] **Bước 2 — Kiểm chứng responsive bằng Edge.** Với light và dark, kiểm tra 320, 768, 1024, 1440 px. Điều kiện:

```js
document.documentElement.scrollWidth <= window.innerWidth
document.querySelectorAll('main h1').length === 1
```

- [x] **Bước 3 — Kiểm chứng hành vi bằng Playwright CLI.** Đã chạy assertions tương đương đoạn sau qua `run-code`, sau khi mở trang và chụp snapshot:

```js
async (page) => {
  await page.goto('http://localhost:5173');
  await page.keyboard.press('Tab');
  if (await page.locator(':focus').textContent() !== 'Đến nội dung chính') {
    throw new Error('Skip link not first');
  }
  await page.keyboard.press('Enter');
  if (await page.locator(':focus').getAttribute('id') !== 'public-content') {
    throw new Error('Skip target not focused');
  }
  await page.getByRole('link', { name: 'Khám phá bộ sưu tập', exact: true }).click();
  if (!page.url().endsWith('/collection')) throw new Error('Collection navigation failed');
  await page.getByRole('link', { name: 'Aura Museum — Trang chủ', exact: true }).click();
  if (new URL(page.url()).pathname !== '/') throw new Error('Home navigation failed');
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    await page.waitForTimeout(200);
    if (await page.locator('html').getAttribute('data-mantine-color-scheme') !== colorScheme) {
      throw new Error('Color scheme mismatch');
    }
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      if (!await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)) {
        throw new Error('Overflow at ' + width + ' ' + colorScheme);
      }
    }
  }
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(r => r.name));
  if (resources.some(url => url.includes('/api/rooms'))) throw new Error('Unexpected content request');
  if (await page.locator('main h1').count() !== 1) throw new Error('Heading count');
}
```

- [x] **Bước 4 — Console và diff.** `git diff --check` không báo lỗi whitespace. Console còn 401 từ luồng `/api/auth/me` có sẵn; favicon 404 đã được khắc phục. Không tuyên bố console hoàn toàn sạch hoặc WCAG đã được audit đầy đủ.

## HOME-04: Duyệt trực quan và bàn giao

**Files:** trang chủ đã dựng và hai tài liệu nhiệm vụ.

**Interfaces:** consumes giao diện tại `http://localhost:5173`; produces xác nhận của người dùng về bố cục, màu và khoảng trống.

- [ ] **Bước 1 — Người dùng duyệt desktop/mobile.** Kiểm tra typography, minh họa kiến trúc, CTA, header/footer, màu light/dark và khoảng trống dưới `Hiện vật nổi bật`.
- [ ] **Bước 2 — Sửa theo feedback và kiểm tra lại phần thay đổi.** Nếu đổi mã frontend, chạy lại ba quality gate; nếu đổi bố cục, kiểm chứng lại viewport liên quan.
- [ ] **Bước 3 — Ghi kết quả review.** Cập nhật task khi có bằng chứng; không tự coi DOM assertions là review trực quan.

## Self-review và tình trạng bàn giao

- Phạm vi người dùng đã chốt được ánh xạ tới HOME-01/02; kiểm chứng tới HOME-03; duyệt trực quan tới HOME-04.
- Tên component, route, selector và palette nhất quán với code đã triển khai.
- Đây là kế hoạch được bổ sung sau triển khai; không có bằng chứng test-first và không dựng lại lịch sử giả.
- Ảnh đã được chụp nhưng phiên không đọc được; HOME-04 còn mở.
- Tài liệu plan/task được commit riêng theo yêu cầu; code frontend chưa commit. Chưa push/tạo PR. Không coi review hay merge đã hoàn thành.
