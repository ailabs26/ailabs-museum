# Frontend coding convention

Phạm vi: `front-end/src/`. Không tạo file rỗng hoặc tên chung chung như `Test.tsx`, `data.ts`, `helper.ts`. Các file chỉ chứa `//` hiện tại là placeholder tạm để giữ cây thư mục trên Git và phải được thay bằng code thật hoặc xóa khi feature tương ứng được triển khai.

## Tên thư mục

- Thư mục layer dùng **lowercase**, số nhiều và giữ theo cấu trúc hiện tại: `apis/`, `components/`, `contexts/`, `helpers/`, `hooks/`, `interfaces/`, `layouts/`, `pages/`, `reducers/`, `utils/`, `validations/`.
- Thư mục con theo feature dùng **kebab-case**, tên rõ domain: `components/exhibit-detail/`, `pages/admin/`, `hooks/museum/`.
- Không tạo thư mục mới ở `src/` nếu chưa thống nhất convention cho thư mục đó.
- `assets/` dành cho asset được bundle cùng source; `public/` dành cho file cần URL tĩnh.

## Tên file

| Loại | Quy tắc | Ví dụ |
| --- | --- | --- |
| React component | `PascalCase.tsx` | `ExhibitPanel.tsx` |
| Page | `PascalCasePage.tsx` | `MuseumPage.tsx` |
| Layout | `PascalCaseLayout.tsx` | `AdminLayout.tsx` |
| Context/provider | `PascalCaseContext.tsx` hoặc `PascalCaseProvider.tsx` | `MuseumContext.tsx` |
| Hook | `usePascalCase.ts` | `useRoom.ts` |
| API module | `camelCaseApi.ts` | `museumApi.ts` |
| Validation schema | `camelCaseSchema.ts` | `exhibitSchema.ts` |
| Reducer | `camelCaseReducer.ts` | `museumReducer.ts` |
| Helper/utility | `camelCase.ts`, tên mô tả hành động/kết quả | `mediaUrl.ts`, `mapExhibit.ts` |
| Type/interface module | `camelCase.ts` | `museum.ts` |
| CSS Module | trùng tên component + `.module.css` | `ExhibitPanel.module.css` |
| Test | trùng file nguồn + `.test`/`.spec` | `useRoom.test.ts` |
| Asset | `kebab-case` | `aura-mark.svg` |

## Export và import

- Tên export chính phải khớp tên file component/page/layout.
- Ưu tiên named export; chỉ dùng default export cho entry point hoặc khi framework yêu cầu.
- Dùng alias `@/` khi import qua thư mục khác; dùng relative path khi import file cùng thư mục.
- Dùng `import type` cho import chỉ chứa type.
- Không tạo barrel `index.ts` chỉ để rút ngắn import; tránh dependency cycle.

## Quy tắc nhanh cho identifier

- Biến và hàm: `camelCase`; component, type, interface: `PascalCase`.
- Không dùng tiền tố `I`/`T`: `Exhibit`, không dùng `IExhibit` hoặc `TExhibit`.
- Boolean bắt đầu bằng `is`, `has`, `can` hoặc `should`: `isLoading`, `hasAudio`.
- Callback prop bắt đầu bằng `on`; handler nội bộ bắt đầu bằng `handle`: `onSelect`, `handleSelect`.
- ID dùng hậu tố `Id`: `roomId`, `exhibitId`, không dùng `roomID`.
- Hằng số cấp module dùng `UPPER_SNAKE_CASE`; không viết hoa mọi biến chỉ vì là `const`.

## Không lệch convention

- Không lấy file scaffold `Test/test*` hiện tại làm mẫu.
- Không đổi tên folder/file hàng loạt trong một feature nếu task không yêu cầu.
- Nếu cần một loại file hoặc thư mục mới, cập nhật file này trước khi dùng rộng rãi.
