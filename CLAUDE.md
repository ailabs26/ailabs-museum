# CLAUDE.md — ailabs-museum

Hướng dẫn cho Claude Code khi làm việc trong dự án này.

## Ngôn ngữ

Luôn trả lời bằng tiếng Việt — kể cả khi được gọi làm sub-agent (planner, tester,
code-reviewer, debugger...). Giữ nguyên tiếng Anh cho tên biến, tên hàm, thuật ngữ kỹ thuật.
(`settings.json` có "language": "Vietnamese" cho lượt chính; mục này bắt buộc thêm cho
sub-agent vì sub-agent chỉ nhận được dòng nhắc yếu từ hook, dễ bị lấn át bởi system prompt
tiếng Anh dài của từng agent.)

## Phạm vi cấu hình — chỉ đọc `.claude/`

Dự án này có thể có cả `.claude/` (Claude Code) và `.agents/` (Codex/Agent CLI, và riêng
`.agents/rules`, `.agents/workflows`, `.agents/agent`, `.agents/hooks.json` cho Google
Antigravity - vendor từ ag-kit). **Là Claude Code, CHỈ đọc và tuân theo nội dung trong
`.claude/`** (skill, agent, rule, CLAUDE.md này). KHÔNG tự ý đọc hay áp dụng nội dung trong
`.agents/rules/*.md` hoặc `.agents/agent/*.md` — chúng viết cho Antigravity, dùng ngôn ngữ
"MANDATORY"/"BẮT BUỘC" nghe như áp dụng chung nhưng thực ra chỉ dành cho agent roster riêng
của Antigravity (khác tên với agent của kit này). Chỉ đọc `.agents/` khi người dùng yêu cầu
rõ ràng (ví dụ: "xem thử .agents/rules/code-rules.md đang nói gì").

## Stack

- **Back-end:** NestJS 10 + TypeScript, PostgreSQL + TypeORM 0.3 (migration, `synchronize` luôn tắt). Auth: JWT access + refresh token (bcryptjs), RBAC. Swagger ở `/api/docs`.
- **Front-end:** React 18 + TypeScript + Vite, Mantine 7 (UI) + `@tabler/icons-react`, React Router 6, TanStack Query 5, axios.
- Monorepo 2 app: `back-end/`, `front-end/`. Tài liệu kiến trúc ở `docs/`.

## Cấu trúc

- **`back-end/src/`** (chuẩn enterprise):
  - `common/` — hạ tầng global: `decorators/ guards/ filters/ interceptors/ middleware/ exceptions/ dto/ constants/ enums/ types/ repository/ database/ security/` + `CommonModule` (@Global).
  - `config/` — `app/database/jwt.config.ts` (registerAs) + `env.validation.ts` + `data-source.ts` + `index.ts`.
  - `database/` — `migrations/ seeds/ database.module.ts`.
  - `modules/<domain>/` — `controllers/ services/ repositories/ entities/ dto/` (auth, users, roles, audit, exhibits, rooms, media, content-reports, health). Entity đặt theo DDD trong từng module.
- **`front-end/src/`**: `core/` (api, auth, config), `shared/components/` (data, form, feedback, layout), `services/` (gọi API theo domain), `app/` (router, theme), `pages/` (admin, client), `layouts/`.
- **`docs/`**: `architecture/`, `plans/`, `tasks/`, `Diagrams/` (ERD/RBAC/auth-flow + bản vẽ gốc).

## Lệnh

- Back-end (trong `back-end/`): `npm run dev` (watch), `npm run build`, `npm run typecheck`, `npm run lint`, `npm run migration:run`, `npm run seed`.
- Front-end (trong `front-end/`): `npm run dev`, `npm run build`, `npm run typecheck`, `npm run lint`.

## Quy ước

- **Luồng BE:** Controller → Service → Repository; chỉ Repository chạm TypeORM. Repository nên `extends BaseRepository`. Thao tác nhiều bảng dùng `TransactionManager`.
- **Response:** không tự bọc — `ResponseInterceptor` bọc `ApiResponse<T>`; list trả `Paginated<T>`. Lỗi ném exception chuẩn, `AllExceptionsFilter` chuẩn hóa.
- **RBAC:** guard toàn cục; `@Public()` cho route công khai, `@Permissions('resource:action')` cho route quản trị, `@Audit('resource.action','resource')` để ghi vết. Không trả `passwordHash`/token.
- **Config:** truy cập key namespaced (`config.getOrThrow('jwt.accessSecret')`, `'app.port'`...).
- **FE:** mọi API qua `core/api/http-client` + service layer + react-query; RBAC bằng `RequireAuth`/`RequirePermission` (chốt chặn thật ở BE); dùng `shared/components`.
- Chi tiết: `back-end/docs/coding-conventions.md`, `front-end/docs/coding-conventions.md`.
- **Git:** nhánh từ `dev`, commit nhỏ & chi tiết, luôn PR vào `dev` rồi merge; không merge thẳng `main`.

<!-- CODEGRAPH_START -->
## CodeGraph (BẮT BUỘC / MANDATORY)

Khi làm việc trong kho mã nguồn đã có thư mục `.codegraph/`, AI Agent BẮT BUỘC PHẢI DÙNG CodeGraph trước khi dùng grep/find hoặc đọc file thủ công:
- **MCP Tool (Khuyên dùng):** Gọi `codegraph_explore` để trả lời câu hỏi cấu trúc, luồng code, và symbol trong 1 lượt gọi duy nhất — trả về verbatim source kèm call paths và blast radius.
- **Terminal / Subagent:** `codegraph explore "<symbol names hoặc câu hỏi>"` cho kết quả tương tự.
- **Hướng dẫn chi tiết:** Xem `.claude/codegraph-guide.md`.
<!-- CODEGRAPH_END -->

## Ghi chú riêng của dự án

<!-- Bổ sung quy ước, lưu ý, gotcha của dự án tại đây -->
