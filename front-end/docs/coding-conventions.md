# Frontend coding convention

Phạm vi: `front-end/src/`. Không tạo file rỗng hoặc tên chung chung như `Test.tsx`, `data.ts`, `helper.ts`. Các file chỉ chứa `//` hiện tại là placeholder tạm để giữ cây thư mục trên Git và phải được thay bằng code thật hoặc xóa khi feature tương ứng được triển khai.

## Cấu trúc thư mục hiện tại

- **`core/`** — hạ tầng không phụ thuộc UI feature: `core/api/` (http-client, api-response, api-error, query-client, loading-store), `core/auth/` (AuthProvider/context, use-auth, RequireAuth, RequirePermission, token-store, permissions, types), `core/config/` (env).
- **`shared/components/`** — component dùng chung, nhóm theo loại: `data/` (DataTable, StatCard, EmptyState), `form/` (FormTextField, FormPassword, FormSelectField…), `feedback/` (notify, confirm, ErrorBoundary, GlobalLoadingBar), `layout/` (PageHeader).
- **`services/`** — tầng gọi API theo domain (`users.service.ts`, `roles.service.ts`, `audit.service.ts`, `auth.service.ts`); mọi service đi qua `core/api/http-client`.
- **`app/`** — `router.tsx`, `theme.ts` cấp ứng dụng. `AppProviders.tsx` gộp provider.
- **`pages/`** — theo khu vực: `pages/admin/`, `pages/client/`. **`layouts/`** — `AdminLayout`, `PublicLayout`, `MuseumLayout`.
- Các thư mục feature bảo tàng hiện có: `apis/`, `components/`, `contexts/`, `hooks/`, `interfaces/`, `reducers/`, `helpers/`, `utils/`, `validations/`.
- Thư mục layer dùng **lowercase**; thư mục con theo feature dùng **kebab-case** rõ domain (`pages/admin/`, `hooks/museum/`).
- `assets/` cho asset bundle cùng source; `public/` cho file cần URL tĩnh. Không tạo thư mục mới ở `src/` nếu chưa thống nhất.

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

## Gọi API & data fetching

- **Mọi lời gọi API đi qua `core/api/http-client`** (`http.get/getPage/post/patch/put/delete`); không gọi `axios`/`fetch` rải rác. http-client tự gắn Bearer, gửi cookie refresh, auto-refresh 401 (single-flight), và cập nhật `loading-store` (thanh loading toàn cục).
- Mỗi domain có một `*.service.ts` trong `services/`; component không tự dựng URL.
- Response đã bóc envelope `ApiResponse<T>` → trả thẳng `data`; endpoint list trả `Page<T>` (`items`, `page`, `pageSize`, `total`).
- Dùng **react-query** (`useQuery`/`useMutation`) cho fetch/mutation trong page; invalidate query sau mutation. Lỗi là `ApiException` (có `status`, `fieldErrors`).

## Xác thực & RBAC (FE)

- Trạng thái phiên qua `AuthProvider` + `useAuth()` (`user`, `hasPermission`, `hasAnyPermission`); access token giữ ở `token-store` (bộ nhớ), refresh qua httpOnly cookie.
- Chặn route bằng `RequireAuth`; ẩn/hiện theo quyền bằng `RequirePermission` (hoặc `hasPermission`). Danh mục quyền FE ở `core/auth/permissions.ts` **mirror** BE — **chốt chặn thật nằm ở backend**, FE chỉ cho UX.

## Component dùng chung & phản hồi

- Tái dùng `shared/components` (DataTable, Form*, StatCard, PageHeader); không tạo trùng.
- Thông báo dùng `notify` (`success/error/info`), xác nhận dùng `confirmAction`; không gọi thẳng `@mantine/notifications`/`modals` rải rác.
- UI dùng **Mantine** + `@tabler/icons-react`; không trộn thư viện UI khác.

## Export/Import bổ sung

- Page/component/layout dùng **named export** khớp tên file (`export function UsersPage`).
- Dùng alias `@/` khi import qua thư mục khác; relative path cho file cùng thư mục; `import type` cho type.

## Không lệch convention

- Không lấy file scaffold `Test/test*` hiện tại làm mẫu.
- Không đổi tên folder/file hàng loạt trong một feature nếu task không yêu cầu.
- Nếu cần một loại file hoặc thư mục mới, cập nhật file này trước khi dùng rộng rãi.
