# Hướng Dẫn Agent Kit — ClaudeKit + bộ kỹ năng DTSOFT

Chào mừng đến với **Agent Kit**. Đây là cẩm nang cho bộ cấu hình Claude Code dùng chung của DTSOFT: nền **ClaudeKit Engineer v2.18.0** cộng các lớp bổ sung (Superpowers, ECC, Templates, Matt Pocock, VoltAgent, CodeGraph…) và bộ command riêng cho .NET + Angular.

> File này được `install-kit.ps1` phân phối kèm kit và nằm tại `.claude/claudekit-guide.md` trong dự án đích. Bản dành cho Agent CLI / Codex: [`.agents/agents-guide.md`](../.agents/agents-guide.md).

Chọn lối vào phù hợp với việc bạn đang làm:

| Bạn đang… | Đọc phần | Mô tả |
| --- | --- | --- |
| Mới cài kit lần đầu | [Chọn Thiết Lập](#chọn-thiết-lập) · [Kit, Skill, Agent & Hook](#kit-skill-agent--hook) | Chọn cách cài, hiểu bốn khái niệm cốt lõi |
| Chưa biết gọi lệnh nào | [Tìm Lệnh Phù Hợp](#tìm-lệnh-phù-hợp) · [Bảng Lệnh Nhanh](#bảng-lệnh-nhanh) | Từ "tôi muốn…" ra đúng lệnh |
| Làm một việc cụ thể | [Quy Trình Mẫu](#quy-trình-mẫu) | Tính năng mới, sửa lỗi, refactor, review & ship, tài liệu |
| Gặp sự cố | [Khôi Phục Session](#khôi-phục-session) · [Sửa Lỗi Từ Log](#sửa-lỗi-từ-log) · [Xử Lý Sự Cố](#xử-lý-sự-cố) | Mất phiên, lỗi từ log, hook/skill không chạy |
| Muốn hiểu kit vận hành ra sao | [Inside Agent Kit](#inside-agent-kit) | Nền + lớp bổ sung, hook, quy ước trùng tên |
| Bảo trì kit | [Cập Nhật & Cài Lại Clean](#cập-nhật--cài-lại-clean) | Đồng bộ nền, cập nhật nguồn, kiểm tra toàn vẹn |

## Mục lục

1. [Chọn Thiết Lập](#chọn-thiết-lập)
2. [Gói Cài Đặt](#gói-cài-đặt)
3. [Kit, Skill, Agent & Hook](#kit-skill-agent--hook)
4. [Tổng Quan Quy Mô](#tổng-quan-quy-mô)
5. [Tìm Lệnh Phù Hợp](#tìm-lệnh-phù-hợp)
6. [Bảng Lệnh Nhanh](#bảng-lệnh-nhanh)
7. [Quy Trình Mẫu](#quy-trình-mẫu)
8. [Khôi Phục Session](#khôi-phục-session)
9. [Sửa Lỗi Từ Log](#sửa-lỗi-từ-log)
10. [Cheatsheet Skill Theo Chuyên Môn](#cheatsheet-skill-theo-chuyên-môn)
11. [Sub-Agent](#sub-agent)
12. [Commands Riêng Cho .NET + Angular](#commands-riêng-cho-net--angular)
13. [Hook & An Toàn](#hook--an-toàn)
14. [MCP](#mcp)
15. [CodeGraph](#codegraph)
16. [Inside Agent Kit](#inside-agent-kit)
17. [Nguồn Tích Hợp & Ứng Viên](#nguồn-tích-hợp--ứng-viên)
18. [Cập Nhật & Cài Lại Clean](#cập-nhật--cài-lại-clean)
19. [Xử Lý Sự Cố](#xử-lý-sự-cố)
20. [Tài Nguyên](#tài-nguyên)

---

## Chọn Thiết Lập

Chọn lệnh cài theo tình huống của dự án:

| Tình huống | Lệnh | Ghi chú |
| --- | --- | --- |
| Dự án **.NET + Angular** của công ty | `agent-install` | Cài `.claude` + `.codegraph`, hỏi thông tin dự án, tự điền placeholder cho `commands/field/*` |
| Dự án **khác** (Node, Python, CMS…) | `agent-install -NoCommands` | Bỏ bộ command `field:*` |
| Dự án dùng **Agent CLI / Codex** | `agent-install -Agents` | Cài thêm `.agents/skills` (mặc định không cài) |
| Muốn **rules ClaudeKit** (workflow bắt buộc) | `agent-install -Rules` | 7 file rule tự nạp vào mọi phiên; mặc định không cài để khỏi nạp trùng với `~/.claude/rules` |
| **Giảm số skill/agent nạp** | `agent-install -Profile dotnet-angular` | Xem [Gói cài đặt](#gói-cài-đặt) — mặc định `workday` (gọn cho hằng ngày) |
| Không muốn bị hỏi | `agent-install -NoPrompt` | Chỉ tự dò cấu trúc dự án |
| **Xem trước** khi cài vào dự án đã có `.claude` | `agent-install -DryRun` (hoặc `install-kit.ps1 -Target <dự án> -DryRun`) | In ra sẽ thêm/ghi đè/xóa gì, không ghi gì |
| Giữ nguyên skill/agent cũ đã gỡ khỏi kit | `-NoPrune` | Mặc định installer xóa đúng các tên trong `kit-dropped.json` khỏi dự án đã cài bản cũ |
| Ghi đè cấu hình đã có | `agent-install -Force` | Ghi đè `settings.json`, `.ck.json`, `CLAUDE.md`, `commands/field` |

Đã cài `agent-install` từ trước? Chạy lại `setup-agent-install-command.ps1 -Force` để lệnh nhận cờ mới (như `-Rules`). Chưa có lệnh `agent-install`? Xem [README.md](../README.md) (cài lệnh toàn cục một lần mỗi máy, hoặc dùng `new-project.ps1`). Sau khi cài: viết `./CLAUDE.md` riêng cho dự án, kiểm tra `.claude/commands/field/*.md`, **restart Claude Code**.

## Gói Cài Đặt

Kit có hơn 800 skill và 300 sub-agent — dự án nào cũng không cần hết, và danh sách quá dài làm loãng những skill thật sự cần (ngân sách mô tả skill chỉ vài phần trăm ngữ cảnh). `-Profile` chỉ chép phần thuộc gói:

| Gói | Skill / Agent | Gồm | Dùng cho |
| --- | :---: | --- | --- |
| `minimal` | 106 / 16 | Lõi ClaudeKit (`ck:*` chính) + kỷ luật phát triển (Superpowers, Matt Pocock, Ponytail, `/careful`, `/freeze`) + agent cốt lõi | Dự án bất kỳ, muốn nhẹ nhất |
| `workday` | 189 / 16 | `minimal` + dữ liệu thường dùng, bảo mật, tài liệu/sơ đồ, DevOps; không nạp Firecrawl/mem0/browser-use | Mặc định gọn cho công việc hằng ngày |
| `dotnet-angular` | 245 / 82 | `workday` + .NET, kiến trúc Clean/CQRS/DDD, thiết kế API, Angular/TypeScript/UI/a11y/E2E + agent tương ứng | Dự án .NET + Angular của công ty |
| `web` | 255 / 105 | `workday` + Angular/React/Next/Vue/Node và agent web | Dự án web JavaScript/TypeScript |
| `research` | 230 / 39 | `workday` + Firecrawl, mem0, Browser Use | Nghiên cứu web-data, crawl/scrape, memory layer, browser automation |
| `full` | <!--n:skills-->1828<!--/n--> / <!--n:agents-->332<!--/n--> | Toàn bộ kit | Khi cần đủ mọi chuyên môn |

- Chọn gói: `agent-install -Profile dotnet-angular` (hoặc `install-kit.ps1 -Target <dự án> -Profile dotnet-angular`). Xem trước bằng `-DryRun`.
- Gói ghi vào `.claude/kit-install.json` (cùng phiên bản kit); lần cài sau không nêu `-Profile` sẽ dùng lại gói đó. `-Profile` mới chỉ thêm phần thiếu, **không gỡ** skill đã có.
- Thành phần từng gói nằm trong `kit-profiles.json` (nhóm skill/agent, tên thư mục hoặc mẫu `*`); sửa file này để thêm/bớt, `node scripts/validate-kit.cjs` kiểm tra tên còn tồn tại.
- Skill ngoài gói vẫn tìm được bằng `/ck:find-skills`, và có thể chép tay từ kit khi cần.

## Kit, Skill, Agent & Hook

Bốn khối xây dựng của kit — hiểu chúng là hiểu kit:

| Khối | Là gì | Nằm ở | Kích hoạt |
| --- | --- | --- | --- |
| **Skill** | Bộ chỉ dẫn (`SKILL.md` + `references/` + `scripts/`) dạy Claude làm một việc | `.claude/skills/<tên>/` | Gõ `/tên-skill`, hoặc Claude tự chọn theo mô tả |
| **Sub-agent** | Trợ lý chuyên trách chạy trong ngữ cảnh riêng | `.claude/agents/<tên>.md` | Claude giao việc qua công cụ Task, hoặc skill gọi theo tên |
| **Hook** | Script `.cjs` chạy theo sự kiện (mở phiên, trước/sau công cụ…) | `.claude/hooks/` | Tự động, đăng ký trong `.claude/settings.json` |
| **Command** | Lệnh riêng của công ty, dạng template có placeholder | `.claude/commands/field/` | Gõ `/field:tên` |

Lưu ý cách gọi: skill ClaudeKit khai báo `name: ck:plan` nên gõ **`/ck:plan`** (thư mục là `ck-plan`). Skill của nguồn khác gõ theo tên thư mục, ví dụ `/brainstorming`. Gặp tên trùng, xem [Quy ước trùng tên](#quy-ước-trùng-tên--claudekit-thắng).

## Tổng Quan Quy Mô

| Thư mục / Tập tin | Quy mô | Vai trò |
| --- | :---: | --- |
| `.claude/skills/` | **<!--n:skills-->1828<!--/n--> skill** | Toàn bộ kỹ năng (mỗi thư mục = 1 slash command hoặc skill tự kích hoạt); 77 skill là của ClaudeKit (`ck:*`) |
| `.agents/skills/` | **<!--n:agents-skills-->1763<!--/n--> skill** | Cây kỹ năng tương thích Agent CLI / Codex (tuỳ chọn khi cài) |
| `.claude/agents/` | **<!--n:agents-->332<!--/n--> agent** | Sub-agent theo ngôn ngữ, kiến trúc, cơ sở dữ liệu, cloud, bảo mật; 13 agent cốt lõi của ClaudeKit |
| `.claude/mcps/` | **<!--n:mcps-->103<!--/n--> mẫu** | Cấu hình mẫu MCP Server (Database, Playwright, DevTools, Web Data, Productivity…) |
| `.claude/commands/field/` | **<!--n:field-commands-->9<!--/n--> lệnh** | Workflow thêm trường dữ liệu xuyên 4 tầng .NET Clean Arch + Angular |
| `.claude/hooks/` | **<!--n:hooks-->19<!--/n--> hook** | Kiểm soát chất lượng, bảo mật, nhắc YAGNI/KISS, Kanban, statusline |
| `.claude/rules/` | 7 rule + script | Rule quy trình ClaudeKit (tuỳ chọn khi cài) và script chuẩn hoá mã .NET |
| `.claude/{scripts,output-styles,schemas,.ck.json,.ckignore}` | Nền ClaudeKit | Script hỗ trợ, 6 mức `coding-level`, schema cấu hình, cấu hình mặc định hook |
| `.claude/settings.json` | Cấu hình | **`permissions.allow` chỉ có `mcp__codegraph__*`** — mỗi dự án tự tích lũy thêm quyền của riêng mình |
| `.claude/statusline.cjs` | Terminal | Context usage, nhánh git, quota Claude trên statusline |

---

## Tìm Lệnh Phù Hợp

Đi từ điều bạn muốn làm tới lệnh nên gọi:

| Tôi muốn… | Gọi | Vì sao |
| --- | --- | --- |
| Bắt đầu dự án mới từ số 0 | `/ck:bootstrap` | Nghiên cứu → chọn stack → thiết kế → lập kế hoạch → triển khai |
| Thêm tính năng, chưa rõ phạm vi | `/ck:plan` rồi `/ck:cook` | Lập kế hoạch trước, triển khai sau, có test + review |
| Thêm tính năng nhỏ, đã rõ | `/ck:cook "…"` | Tự lập kế hoạch nội bộ rồi làm luôn |
| Chọn giữa nhiều hướng kỹ thuật | `/ck:brainstorm` | Phân tích trade-off, phản biện thẳng thắn |
| Hiểu code/kiến trúc, chưa sửa | `/ck:ask`, `/ck:scout` | Chỉ phân tích, không đụng code |
| Có lỗi cụ thể / CI đỏ / lỗi type | `/ck:fix` | Tự chọn quy trình (nhanh, tự động, review, song song) |
| Chưa biết lỗi từ đâu | `/ck:debug` | Chứng minh nguyên nhân gốc trước khi sửa |
| Review thay đổi trước khi merge | `/ck:code-review --pending` (hoặc `#PR`, mã commit) | Review đối kháng có red-team |
| Chạy test | `/ck:test`, `/ck:test ui <url>` | Chạy và phân tích kết quả |
| Commit / mở PR | `/ck:git cm`, `/ck:git pr`, `/ck:ship` | Commit conventional; `ship` chạy cả chuỗi merge → test → review → PR |
| Cập nhật tài liệu dự án | `/ck:docs update` | Đồng bộ `./docs` với code |
| Nghiên cứu một công nghệ | `/ck:research "…"`, `/ck:docs-seeker` | Nhiều nguồn; docs-seeker tra tài liệu mới nhất của thư viện |
| Tóm tắt trạng thái / bàn giao | `/ck:watzup`, `/ck:project-management` | Việc đã xong, đang làm, tiếp theo |
| Làm việc song song, cách ly | `/ck:worktree`, `/ck:team` | Worktree riêng; nhóm agent nhiều phiên |
| Tìm skill cho việc lạ | `/ck:find-skills` | Gợi ý skill theo mô tả |

Lệnh bạn nhớ tên nhưng không thấy? Gõ `/` để xem danh sách, hoặc hỏi Claude bằng lời thường.

## Bảng Lệnh Nhanh

Các skill ClaudeKit dùng nhiều nhất và cờ chính của chúng (đọc từ `argument-hint` trong từng `SKILL.md`):

| Lệnh | Cú pháp chính | Dùng khi |
| --- | --- | --- |
| `/ck:plan` | `[task] [--fast\|--hard\|--deep\|--parallel\|--two] [--tdd]` hoặc `archive\|red-team\|validate` | Việc cần phase, kiến trúc, roadmap |
| `/ck:cook` | `[task\|plan-path] [--interactive\|--fast\|--parallel\|--auto]` | Triển khai phạm vi đã rõ |
| `/ck:fix` | `[issue] --auto\|--review\|--quick\|--parallel` | Lỗi cụ thể, CI, lỗi type |
| `/ck:debug` | `[mô tả lỗi]` | Cần chứng minh nguyên nhân gốc |
| `/ck:code-review` | `[#PR \| COMMIT \| --pending \| codebase [parallel]]` | Review diff, PR, commit, cả codebase |
| `/ck:test` | `[context]` hoặc `ui [url]` | Chạy test, kiểm thử UI |
| `/ck:git` | `cm\|cp\|pr\|merge [args]` | Commit, push, PR, merge |
| `/ck:ship` | `[official\|beta] [--skip-tests] [--skip-review]` | Đưa nhánh xong thành PR |
| `/ck:docs` | `init\|update\|summarize` | Tài liệu dự án |
| `/ck:scout` | `[mục tiêu tìm] [ext]` | Khám phá nhanh codebase |
| `/ck:ask` | `[câu hỏi kỹ thuật]` | Hỏi đáp, không sửa code |
| `/ck:brainstorm` | `[chủ đề]` | Chọn hướng giải quyết |
| `/ck:research` | `[chủ đề]` | Nghiên cứu công nghệ |
| `/ck:security` | `<scope\|full> [--fix] [--red-team]` | Audit bảo mật STRIDE + OWASP |
| `/ck:security-scan` | `[scope] [--secrets-only] [--deps-only] [--full]` | Quét secrets, phụ thuộc, OWASP |
| `/ck:worktree` | `[mô tả tính năng]` | Nhánh làm việc cách ly |
| `/ck:team` | `<template> <context> [--devs\|--researchers\|--reviewers N]` | Nhóm agent nhiều phiên |
| `/ck:bootstrap` | `[yêu cầu] [--full\|--auto\|--fast\|--parallel]` | Dự án mới |
| `/ck:preview` | `[đường dẫn] [--html] --explain\|--slides\|--diagram\|--ascii` | Giải thích trực quan, sơ đồ |
| `/ck:coding-level` | `[0-5]` | Chỉnh độ sâu giải thích cho hợp trình độ |
| `/ck:watzup` · `/ck:journal` | — | Bàn giao phiên · nhật ký kỹ thuật |

## Quy Trình Mẫu

### Tính năng mới

```text
/ck:brainstorm "…"          # (tuỳ chọn) chọn hướng
/ck:plan "thêm thông báo real-time"     # thêm --deep nếu lớn, --tdd nếu cần test-first
/ck:cook <đường-dẫn-tuyệt-đối>/plans/…/plan.md   # cook đã gồm test + review
/ck:docs update
/ck:watzup
```

### Sửa lỗi

```text
/ck:debug "đăng nhập thất bại thỉnh thoảng"    # khi chưa rõ nguyên nhân
/ck:fix "lỗi xác thực"                          # có mô tả cụ thể, log, CI…
/ck:test
```

### Các luồng khác

**Refactor an toàn:** `/ck:plan --tdd "refactor middleware xác thực"` → `/ck:cook <plan> --tdd`. Kết hợp `ponytail-audit` để phát hiện code thừa (xem [nhóm 8](#8-triết-lý-coding-năng-suất--tiện-ích)).

**Review & ship:** `/ck:code-review --pending` → sửa theo phản hồi (skill `receiving-code-review`) → `/ck:ship` (merge nhánh chính, test, review, commit, push, mở PR/MR).

**Dự án mới:** `/ck:bootstrap "…"` (`--fast` bỏ qua nghiên cứu, `--parallel` nhiều agent).

**Kỷ luật Superpowers** (chạy song song với luồng trên): `brainstorming` → `planning-and-task-breakdown` → `subagent-driven-development` → `finishing-a-development-branch`.

**Tài liệu:** `/ck:docs update`; `repomix` sinh `docs/codebase-summary.md`; `/ck:watzup` xem trạng thái.

**Thêm trường dữ liệu (.NET + Angular):** xem [Commands riêng](#commands-riêng-cho-net--angular).

## Khôi Phục Session

Mất ngữ cảnh, đóng nhầm terminal, hay phiên bị nén (compact)? Theo thứ tự:

1. **Tiếp tục phiên gần nhất:** `claude --continue` (hoặc `claude --resume` để chọn một phiên cũ).
2. **Hook `session-state`** lưu tiến độ phiên (ở `~/.claude/session-states/`, ngoài thư mục dự án nên không làm bẩn repo) và nạp lại sau khi nén ngữ cảnh — bạn sẽ thấy khối "Session State (Post-Compaction Recovery)" ở đầu phiên.
3. **Kế hoạch còn nguyên trong `plans/`:** mở lại bằng `/ck:cook <đường-dẫn>/plan.md`; `/ck:plans-kanban` hiển thị bảng tiến độ các plan.
4. **Bàn giao có chủ đích:** trước khi dừng, chạy `/ck:watzup` (tóm tắt việc đã xong/đang làm/tiếp theo) và `/ck:journal` (quyết định và bài học).
5. **Plan đang active bị sai?** `node .claude/scripts/set-active-plan.cjs <thư-mục-plan>` đặt lại plan cho các sub-agent (cần biến môi trường `CK_SESSION_ID` của phiên).

## Sửa Lỗi Từ Log

`/ck:fix` tự chọn quy trình theo loại lỗi (có các workflow riêng cho **log ứng dụng**, **CI/GitHub Actions**, **lỗi type TypeScript**):

```text
/ck:fix "API trả 500 khi tạo đơn hàng. Log: logs/app-2026-09-21.log"
/ck:fix "CI đỏ trên PR #123"
/ck:fix "lỗi type ở src/app/orders" --quick
```

- Đưa **đường dẫn file log** hoặc dán đoạn log có stack trace vào mô tả; skill giao cho các agent `debugger`, `researcher`, `planner`, `code-reviewer`, `tester` tuỳ độ phức tạp.
- Lỗi chưa rõ nguyên nhân: `/ck:debug` trước, rồi `/ck:fix`.
- Lỗi của **hook** (không phải code dự án): xem `.claude/hooks/.logs/hook-log.jsonl` — mỗi dòng ghi hook, sự kiện, trạng thái (`ok`/`skip`/`crash`) và thông báo lỗi.
- Lỗi production quan trọng: thêm `--review` để dừng chờ duyệt ở từng bước.

---

## Cheatsheet Skill Theo Chuyên Môn

Gọi bằng `/tên-kỹ-năng` hoặc để Claude tự kích hoạt theo ngữ cảnh. Bảng dưới liệt kê skill nổi bật; tìm skill khác bằng `/ck:find-skills`.

### 1. Kiến trúc, Lập kế hoạch & Thiết kế Hệ thống

| Lệnh / Kỹ năng | Nguồn | Mô tả & Ứng dụng |
| --- | --- | --- |
| `/ck:plan` | ClaudeKit | Lập kế hoạch kiến trúc chi tiết, phân rã công việc trước khi viết code |
| `/ck:brainstorm` | ClaudeKit | Phân tích trade-off, phản biện thẳng thắn theo YAGNI/KISS/DRY (giao cho agent `brainstormer`) |
| `/brainstorming` | Superpowers | Khám phá ý tưởng, xác định yêu cầu trước khi làm tính năng mới |
| `/architecture` | Templates/ECC | Quyết định kiến trúc, trade-off, viết ADR |
| `/architecture-patterns` | Templates | Clean Architecture, Hexagonal, Domain-Driven Design |
| `/domain-modeling` | Matt Pocock | Mô hình nghiệp vụ, viết `CONTEXT.md` |
| `/to-spec` · `/to-tickets` | Matt Pocock | Ý tưởng thô → đặc tả → đầu việc nguyên tử |
| `/grilling` · `/grill-me` | Matt Pocock | Chất vấn sâu để bóc giả định sai trong thiết kế |
| `/planning-and-task-breakdown` | Superpowers | Phân rã việc, tự rà soát, bàn giao thực thi |

### 2. Front-End, Web & UI

| Lệnh / Kỹ năng | Nguồn | Mô tả & Ứng dụng |
| --- | --- | --- |
| `/angular` | Templates | Angular hiện đại (v17–v20+): Signals, Standalone, Zoneless, RxJS |
| `/frontend-patterns` | ECC | Quản lý state, tối ưu render, tổ chức component |
| `/ck:frontend-design` | ClaudeKit | Dựng UI từ ảnh chụp/mockup/video |
| `/frontend-design-anthropic` | Anthropic | Hướng thẩm mỹ, typography, tránh giao diện "mẫu" |
| `/ck:ui-styling` · `/shadcn` · `/tailwind-design-system` | ClaudeKit/Templates | shadcn/ui, Tailwind, design tokens, dark mode |
| `/ck:ui-ux-pro-max` · `/ck:web-design-guidelines` | ClaudeKit | Chiến lược UX, design system, kiểm tra accessibility/UX |
| `/nextjs-app-router-patterns` · `/ck:web-frameworks` | Templates/ClaudeKit | Next.js App Router, RSC, SSR, Turborepo |
| `/react-component-performance` · `/ck:react-best-practices` | Templates/ClaudeKit | Chẩn đoán render chậm, tối ưu React/Next |
| `/tanstack-query-expert` · `/zod-validation-expert` · `/zustand-store-ts` | Templates | Server state, validation, client state |
| `/sveltekit` · `/astro` · `/hono` | Templates | Framework thế hệ mới |

### 3. Back-End, API & Lập trình

| Lệnh / Kỹ năng | Nguồn | Mô tả & Ứng dụng |
| --- | --- | --- |
| `/dotnet-backend` | Templates | ASP.NET Core 8+, EF Core, DI, Middleware, CQRS |
| `/csharp-pro` | Templates/ECC | C# nâng cao: record, pattern matching, async, LINQ |
| `/ck:backend-development` | ClaudeKit | API REST/GraphQL/gRPC, xác thực, bảo mật OWASP, Docker/K8s |
| `/api-design-principles` | Templates | REST/GraphQL: status code, phân trang, định dạng lỗi |
| `/microservices-patterns` | Templates | Service Discovery, API Gateway, Circuit Breaker, Saga |
| `/fastapi-pro` · `/golang-pro` · `/rust-pro` · `/nodejs-backend-patterns` | Templates | FastAPI/Pydantic v2, Go, Rust, Node.js quy mô lớn |
| `/event-sourcing-architect` | ECC | Event Sourcing và CQRS chuyên sâu |
| `/ck:better-auth` · `/ck:payment-integration` | ClaudeKit | Xác thực (OAuth, MFA, passkeys) · thanh toán (SePay, Stripe, Polar…) |

### 4. Cơ sở dữ liệu & ORM

| Lệnh / Kỹ năng | Nguồn | Mô tả & Ứng dụng |
| --- | --- | --- |
| `/ck:databases` | ClaudeKit | Thiết kế schema, truy vấn MongoDB/PostgreSQL, index, migration |
| `/database-architect` | Templates | Thiết kế tầng dữ liệu, chọn công nghệ, mô hình hoá quan hệ |
| `/database-migration` | Templates | Migration an toàn, zero-downtime, rollback |
| `/postgresql-optimization` | Templates | `EXPLAIN ANALYZE`, index tối ưu cho PostgreSQL |
| `/drizzle-orm-expert` · `/prisma-expert` | Templates | Drizzle, Prisma: type-safe query, schema, pooling |
| `/neon-postgres` · `/using-neon` · `/supabase-postgres-best-practices` | Templates | Postgres serverless Neon; RLS, realtime, Auth trên Supabase |
| `/clickhouse-io` | ECC | Lưu trữ và truy vấn phân tích dữ liệu lớn |

### 5. Sơ đồ, Tài liệu & Trực quan hoá

| Lệnh / Kỹ năng | Nguồn | Mô tả & Ứng dụng |
| --- | --- | --- |
| `/diagram-design` | Cathryn Lavery | 30+ dạng sơ đồ: C4, Wardley, Sequence, Flowchart, ERD, Sankey…; xuất SVG/HTML |
| `/archify` | tt-a1i | Sơ đồ kiến trúc/workflow tương tác dạng HTML/SVG |
| `/ck:mermaidjs-v11` · `/mermaid-diagram-specialist` | ClaudeKit/Templates | Cú pháp Mermaid v11 chuẩn |
| `/ck:tech-graph` | ClaudeKit | Sơ đồ SVG+PNG chất lượng xuất bản |
| `/crafting-effective-readmes` | Templates/ECC | Soạn README chuyên nghiệp |
| `/api-documentation-generator` | Templates | Sinh tài liệu API OpenAPI/Markdown từ code |
| `/pdf` · `/pdf-processing-pro` · `/docx` · `/pptx` · `/xlsx` | Anthropic/Templates | Đọc, tạo, chỉnh PDF, Word, PowerPoint, Excel |

### 6. Kiểm thử, TDD, Debug & QA

| Lệnh / Kỹ năng | Nguồn | Mô tả & Ứng dụng |
| --- | --- | --- |
| `/ck:test` · `/ck:web-testing` | ClaudeKit | Chạy test; Playwright/Vitest/k6, a11y, visual |
| `/test-driven-development` | Superpowers | Red-Green-Refactor có "Iron Law" |
| `/tdd` · `/tdd-workflow` | Matt Pocock/ECC | TDD theo phong cách từng nguồn (được nhiều skill khác gọi tới) |
| `/systematic-debugging` · `/debugging-and-error-recovery` | Superpowers | Cô lập lỗi có phương pháp; phục hồi khi 3+ lần sửa thất bại |
| `/ck:debug` · `/ck:scenario` | ClaudeKit | Nguyên nhân gốc; sinh edge case và kịch bản QA |
| `/diagnosing-bugs` | Matt Pocock | Vòng lặp chẩn đoán lỗi khó, rò rỉ bộ nhớ, hiệu năng |
| `/playwright` · `/playwright-e2e-builder` | Templates | Kiểm thử E2E với Playwright |
| `/k6-load-testing` | Templates | Kiểm thử tải, benchmark API |
| `/migrate-to-shoehorn` | Matt Pocock | Chuyển `as Type` trong test sang `@total-typescript/shoehorn` |

### 7. Bảo mật & DevSecOps

Nhiều skill bảo mật có vai trò **khác nhau** — không trùng nhau. Chọn theo việc bạn cần:

| Cần… | Dùng | Ghi chú |
| --- | --- | --- |
| Audit cả codebase theo mô hình đe doạ, tự sửa | `/ck:security` | STRIDE + OWASP, vòng lặp red-team, `--fix` |
| Quét nhanh secrets, phụ thuộc, OWASP | `/ck:security-scan` | `--secrets-only`, `--deps-only` |
| Kiểm tra khi **đang viết** code nhạy cảm (input, auth, secrets, API, thanh toán) | `/security-review` | Checklist và pattern của ECC |
| Review theo **ngôn ngữ/framework** cụ thể | `/security-best-practices` | Có reference riêng cho Python, JS/TS, Go… |
| Làm cứng code trước khi chấp nhận dữ liệu không tin cậy | `/security-and-hardening` | Bộ Superpowers/agent-skills |
| Quy trình đánh giá tổng hợp (web, API, pentest, hardening) | `/security-audit` | Gói workflow, gọi các skill khác |
| Tuân thủ, phòng thủ chiều sâu | `/security-compliance` | Tài liệu dài, nhiều mẫu |
| Kiểm thử API (IDOR, rate limit…) · web | `/api-security-testing` · `/web-security-testing` | |
| Mô hình đe doạ · bản đồ quyền sở hữu | `/security-threat-model` · `/security-ownership-map` | |
| Quét cấu hình `.claude/` của chính kit | `/security-scan-agentshield` | AgentShield |
| Bí mật trong CI/CD · SAST · OWASP Top 10 | `/secrets-management` · `/sast-configuration` · `/top-web-vulnerabilities` | |

### 8. Triết lý Coding, Năng suất & Tiện ích

| Lệnh / Kỹ năng | Nguồn | Mô tả & Ứng dụng |
| --- | --- | --- |
| `/ponytail` | Ponytail | Code tối giản, YAGNI, native-first. Lệnh phụ: `/ponytail-audit`, `/ponytail-debt`, `/ponytail-review` |
| `/i-have-adhd` | ayghri | Trả lời cô đọng, action-first, bỏ lý thuyết thừa |
| `/ask-matt` | Matt Pocock | Hỏi đáp TypeScript, generic, type inference |
| `/clean-code` · `/reducing-entropy` | Templates/ECC | Mã sạch thực dụng; dọn code chết |
| `/careful` | gstack (viết lại bằng Node) | **Rào chắn lệnh phá hoại:** hỏi lại trước `rm -rf`, `DROP TABLE`, `git push --force`…; chặn hẳn xoá đệ quy `/`, `~` và force-push lên main/master. Bật theo phiên |
| `/freeze` | gstack (viết lại bằng Node) | **Khoá phạm vi sửa file** vào một thư mục; gỡ bằng `/freeze` → unfreeze. Dùng khi debug |

---

## Sub-Agent

Kit có **<!--n:agents-->332<!--/n--> sub-agent**. Claude tự giao việc cho agent phù hợp, hoặc bạn nêu tên: "dùng `database-optimizer` để tối ưu truy vấn này".

### Agent cốt lõi của ClaudeKit (13)

| Nhóm | Agent | Vai trò |
| --- | --- | --- |
| Phát triển | `planner`, `researcher`, `tester`, `fullstack-developer`, `brainstormer` | Lập kế hoạch, nghiên cứu, chạy test, xây tính năng xuyên tầng, phản biện giải pháp |
| Chất lượng | `code-reviewer`, `code-simplifier`, `debugger` | Review, đơn giản hoá, tìm nguyên nhân gốc |
| Tài liệu & quản lý | `docs-manager`, `git-manager`, `project-manager`, `journal-writer` | Tài liệu, commit conventional, tiến độ plan, nhật ký kỹ thuật |
| Thiết kế | `ui-ux-designer` | Đặc tả thiết kế, component, design system |

### Chọn agent nào

| Nhóm chuyên môn | Agent tiêu biểu | Ghi chú |
| --- | --- | --- |
| **.NET & Angular** | `angular-architect`, `csharp-developer`, `dotnet-core-expert`, `dotnet-framework-4.8-expert`, `CSharpExpert`, `csharp-reviewer`, `WinFormsExpert` | Tối ưu cho stack .NET Clean Architecture + CQRS + Angular của DTSOFT |
| **Ngôn ngữ & nền tảng** | `typescript-pro`, `nextjs-developer`, `vue-expert`, `python-pro`, `golang-pro`, `rust-engineer`, `java-architect`, `spring-boot-engineer`, `powershell-7-expert` | Idiom hiện đại theo từng ngôn ngữ |
| **Reviewer theo ngôn ngữ** | `python-reviewer`, `go-reviewer`, `rust-reviewer`, `java-reviewer`, `kotlin-reviewer`, `react-reviewer`, `vue-reviewer`… | Mỗi ngôn ngữ một reviewer |
| **Cơ sở dữ liệu** | Thiết kế `database-architect` · vận hành `database-administrator` · tối ưu `database-optimizer` · review `database-reviewer`; theo công nghệ `postgres-pro`, `sql-pro`, `nosql-specialist`, `supabase-schema-architect`, `neon-database-architect` | Bốn vai chính, các agent theo công nghệ giữ nguyên |
| **Cloud, DevOps & SRE** | `kubernetes-specialist`, `cloud-architect`, `platform-engineer`, `sre-engineer`, `terraform`, `azure-infra-engineer`, `windows-infra-admin`, `incident-responder` | IaC, K8s, CI/CD, giám sát |
| **Bảo mật** | `security-auditor`, `security-engineer`, `penetration-tester`, `api-security-audit`, `compliance-auditor`, `powershell-security-hardening` | Rà soát lỗ hổng, tuân thủ, hardening |
| **MCP Dev Team** | `mcp-developer`, `mcp-server-architect`, `mcp-protocol-specialist`, `mcp-security-auditor`, `mcp-testing-engineer`, `mcp-integration-engineer` | Thiết kế, viết, debug MCP server; thêm `*-mcp-expert` theo ngôn ngữ |
| **Data, AI & Thanh toán** | `ai-engineer`, `llm-architect`, `data-engineer`, `mlops-engineer`, `payment-integration`, `legacy-modernizer`, `workflow-orchestrator` | AI/LLM, ETL/ELT, MLOps, thanh toán PCI, hiện đại hoá hệ thống cũ |
| **UI, Kiểm thử & Hiệu năng** | `screenshot-ui-analyzer`, `e2e-runner`, `performance-engineer`, `web-vitals-optimizer`, `accessibility-tester` | Phân tích ảnh UI, E2E, Core Web Vitals, a11y |

### Họ chồng lấn: chọn bản chính

Vài họ có nhiều agent/skill làm gần cùng việc. Không xóa hết mà chọn một bản chính, các bản còn lại dùng khi cần góc nhìn khác.

| Họ | Bản chính | Dùng thêm khi |
| --- | --- | --- |
| Lập kế hoạch | skill `/ck:plan` · agent `planner` | Muốn tách nhỏ việc: `planning-and-task-breakdown` |
| Debug | skill `/ck:debug` · agent `debugger` | Lỗi khó tái hiện: `systematic-debugging` |
| Review | skill `/ck:code-review` · agent `code-reviewer` | Thêm reviewer theo ngôn ngữ (`csharp-reviewer`, `typescript-reviewer`…); hai trục: `/code-review-two-axis` |
| Kiểm thử | agent `tester` | Dựng framework tự động: `test-automator`; chiến lược QA: `qa-expert` |
| Bảo mật | skill `/ck:security` · agent `security-reviewer` | Audit tuân thủ: `security-auditor`; hạ tầng: `security-engineer` |
| Kiến trúc | agent `architect` | Đánh giá quyết định hiện có: `architect-reviewer`; backend/cloud: `backend-architect`, `cloud-architect` |
| DevOps/SRE | agent `devops-engineer` | Sự cố đang xảy ra: `incident-responder`; SLO/độ tin cậy: `sre-engineer` |
| Hiệu năng | agent `performance-engineer` | Web: `web-vitals-optimizer` |
| Frontend | agent `frontend-developer` | Theo framework: `angular-architect`, `nextjs-developer`, `vue-expert` |
| Git | skill `/ck:git` · agent `git-manager` | Worktree: `/ck:worktree` |

Kiểm kê chi tiết chồng chéo giữa các agent (kể cả 13 agent đã gỡ): [`plans/reports/inventory-260921-1700-duplicate-agents.md`](../plans/reports/inventory-260921-1700-duplicate-agents.md).

---

## Commands Riêng Cho .NET + Angular

Nhóm `field:*` phục vụ quy trình thêm một trường dữ liệu xuyên 4 tầng của công ty (cài khi dự án là .NET + Angular; `-NoCommands` để bỏ):

| Command | Mục đích |
| --- | --- |
| `/field:scan-be <field - kiểu>` | Vừa thêm field vào Entity → quét BE xem tầng nào còn thiếu (Domain/Dto/Application/API) |
| `/field:add-be <Tên_Trường>` | Viết code BE hoàn chỉnh: Domain → Dto → Application → API |
| `/field:scan-fe <Dto/trường>` | Quét frontend Angular tìm component, service chưa bind field |
| `/field:add-fe <Tên_Trường + kiểu>` | Viết code Angular đưa field lên giao diện |
| `/field:validate <trường + ràng buộc>` | Sinh FluentValidation (BE) + ReactiveForm (FE) theo message chuẩn tiếng Việt |
| `/field:uml <tính năng> + <loại sơ đồ>` | Sinh sơ đồ UML Mermaid v11 / PlantUML |
| `/field:docs-spd <thay đổi> + <mã tài liệu>` | Gap analysis bộ tài liệu phân tích kỹ thuật (SRS, FSD, DD…) |
| `/field:hdsd <đối tượng> + <tính năng>` | Soạn/cập nhật tài liệu Hướng dẫn sử dụng |

**Luồng chuẩn:** `/field:scan-be` → `/field:add-be` → `/field:validate` → `/field:scan-fe` → `/field:add-fe` → `/ck:code-review --pending`

Các command này là **template**: installer điền `{{SLN_PATH}}`, `{{DOMAIN_PROJECT}}`, `{{DOMAINS}}`… bằng cách dò cấu trúc dự án. Kiểm tra `.claude/commands/field/*.md` sau khi cài xem tên project đã đúng chưa.

## Hook & An Toàn

Mọi hook chạy qua `node-hook-runner.sh` (tự tìm Node, thoát êm nếu thiếu Node) và đăng ký trong `.claude/settings.json`:

| Sự kiện | Hook | Tác dụng |
| --- | --- | --- |
| `SessionStart` | `session-init`, `usage-quota-cache-refresh`, `superpowers/session-start` | Nạp ngữ cảnh dự án, plan, quy tắc đặt tên; làm mới quota; nạp kỷ luật Superpowers |
| `UserPromptSubmit` | `dev-rules-reminder`, `simplify-gate`, `usage-quota-cache-refresh`, `codegraph prompt-hook` | Nhắc rule dev (YAGNI/KISS/DRY), chặn phình code, nhắc dùng CodeGraph |
| `PreToolUse` | `privacy-block`, `scout-block`, `protect-files`, `descriptive-name` | Chặn đọc `.env`/key (hỏi bạn); chặn đọc `node_modules`, `dist`, `build`, `vendor`, `.git`… và glob quá rộng để tiết kiệm token; chặn sửa file lõi; nhắc đặt tên file có nghĩa |
| `PostToolUse` | `session-state`, `plan-format-kanban`, `usage-quota-cache-refresh` | Lưu tiến độ; định dạng plan thành Kanban |
| `SubagentStart` / `SubagentStop` | `subagent-init`, `team-context-inject`, `cook-after-plan-reminder`, `session-state` | Nạp ngữ cảnh cho sub-agent; nhắc `cook` sau khi lập plan |
| `Stop` | `session-state` | Lưu trạng thái phiên |
| Theo skill | `careful-check`, `freeze-check` | Chỉ hoạt động khi gọi `/careful`, `/freeze` trong phiên |

- **`scout-block` chặn nhầm?** Thêm `!<tên>` vào `.claude/.ckignore` của dự án (ví dụ `!vendor` cho dự án PHP).
- **`privacy-block`** trả prompt xin phép; chỉ đồng ý khi thực sự cần đọc file nhạy cảm.
- Trạng thái đóng băng của `/freeze` lưu ở `.claude/.freeze-state`.
- Test hook: `node --test .claude/hooks/lib/__tests__/careful-check.test.cjs .claude/hooks/lib/__tests__/freeze-check.test.cjs`.

## MCP

`.claude/mcps/` mang theo **<!--n:mcps-->103<!--/n--> file JSON mẫu**: `database/` (PostgreSQL, Neon, Supabase, MySQL, Redis, MongoDB…), `browser_automation/` (Playwright, browser-use, Browserbase…), `devtools/` (Sentry, GitHub, Grafana, Figma, Terraform, Chrome DevTools…), `web-data/` (Firecrawl, Bright Data, Apify…), `productivity/` (Google Workspace, Notion, Monday…).

**Kích hoạt một MCP:** mở mẫu trong `.claude/mcps/<danh-mục>/<tên>.json` → chép block `mcpServers` → dán vào `.mcp.json` ở gốc dự án (file này đã có mục `codegraph` do `codegraph install` tạo) → restart Claude Code. Dùng `/ck:use-mcp` để khám phá/thực thi công cụ MCP đã cấu hình; `/ck:mcp-builder` để tự viết MCP server.

## CodeGraph

> [!IMPORTANT]
> **Quy định bắt buộc cho AI Agent:** trong dự án đã có `.codegraph/` hoặc MCP `codegraph`, agent **không được** dùng `grep`/`find`/`Read` thủ công để dò mã nguồn. Phải gọi `codegraph_explore` (hoặc CLI `codegraph explore`) để nhận mã nguồn nguyên bản có số dòng, call path và blast radius trong **một lượt**, tiết kiệm 60–85% token.

Công cụ chính: `codegraph_explore` (khảo sát cấu trúc, luồng nghiệp vụ) · `codegraph_node` (đọc file/symbol thay `Read`) · `codegraph_impact` (bán kính ảnh hưởng trước khi sửa) · `codegraph_callers` / `codegraph_callees` (truy vết chiều gọi hàm, xuyên interface, MediatR, DI) · CLI `git diff --name-only | codegraph affected --stdin` (tìm file test bị ảnh hưởng).

Chi tiết và quy trình chuẩn: 📖 [`.claude/codegraph-guide.md`](codegraph-guide.md).

---

## Inside Agent Kit

### Nền + lớp bổ sung

```text
   ClaudeKit Engineer v2.18.0  ──────────────►  .claude/   (payload: skills, agents, hooks, rules, scripts…)
   (claudekit-engineer-main, tải riêng)   sync-claudekit-base.ps1
                                                   ▲
   Superpowers · ECC · Templates · Matt Pocock ────┘   update-skills.ps1  (lớp bổ sung, không ghi đè nền)
   VoltAgent · Diagram Design · Ponytail · ADHD
                                                   │
                                                   ▼   install-kit.ps1 / agent-install
                                          dự án đích: .claude/ (+ .agents/ tuỳ chọn) + .codegraph
```

- **ClaudeKit là bộ chính.** Khung repo (`CLAUDE.md`, `docs/`, `guide/`, `scripts/`, `.claude-archived/`, `LICENSE`…) nằm thẳng ở thư mục gốc kit; payload `claude/` nằm trong `.claude/` (phiên bản ghi ở `.claude/metadata.json`).
- **Các nguồn khác xếp lên trên.** `update-skills.ps1` không ghi đè skill/agent thuộc nền ClaudeKit và không chép lại các skill đã gỡ (`$DroppedSkills`).
- **Cài vào dự án** chỉ copy payload (loại `hooks/.logs`, `__pycache__`), giữ nguyên `settings.json`/`.ck.json` nếu đã có.

### Quy ước trùng tên — ClaudeKit thắng

Skill/agent của nguồn khác trùng tên với ClaudeKit đã được **đổi tên** (không mất nội dung). Gọi tên gốc = bản ClaudeKit.

| Tên gốc (ClaudeKit) | Bản của nguồn khác (đã đổi tên) | Khác biệt |
| --- | --- | --- |
| `/ck:code-review` | `/code-review-two-axis` (Matt Pocock) | ClaudeKit: red-team theo PR/commit/codebase. Bản đổi tên: review 2 trục Standards + Spec song song |
| `/ck:research` | `/research-primary-sources` (Matt Pocock) | ClaudeKit: nghiên cứu công nghệ nhiều nguồn. Bản đổi tên: điều tra nguồn sơ cấp, ghi ra Markdown |
| `/ck:frontend-design` | `/frontend-design-anthropic` | ClaudeKit: dựng UI từ ảnh/video. Bản đổi tên: hướng thẩm mỹ, typography |
| `/ck:mcp-builder` | `/mcp-builder-anthropic` | Cùng mục đích, hai bộ tài liệu khác nhau |
| `/ck:skill-creator` | `/skill-creator-anthropic` | ClaudeKit: eval-driven, benchmark. Bản đổi tên: bản gốc Anthropic |
| `/ck:context-engineering` | `/context-engineering-setup` | ClaudeKit: giới hạn/quota ngữ cảnh. Bản đổi tên: cấu hình rules/context cho phiên |
| `/ck:retro` | `/retro-session` (Matt Pocock) | ClaudeKit: hồi cứu kỹ thuật từ lịch sử git. Bản đổi tên: hồi cứu một phiên làm việc để cải thiện môi trường của agent |

### Vì sao kit "gọn" hơn danh sách nguồn

Đã kiểm kê và gỡ 43 skill trùng/chồng nhau và 13 agent (7 bản mỏng nằm trong bản đầy đủ + 6 bản ECC của agent ClaudeKit) — báo cáo: [skill](../plans/reports/inventory-260921-1520-duplicate-skills.md), [agent](../plans/reports/inventory-260921-1700-duplicate-agents.md); `node scripts/validate-kit.cjs` kiểm tra không trùng `name:`, không có hook thiếu file, số liệu trong tài liệu khớp thực tế.

---

## Nguồn Tích Hợp & Ứng Viên

> Muốn tích hợp thêm một nguồn mở mới? Đọc [`docs/integrating-new-open-source.md`](../docs/integrating-new-open-source.md) trước — quy trình 3 nhánh (skill thường / vendor riêng cho tool khác / không tích hợp được) rút ra từ các lần làm thật.

| # | Nguồn | Repository | Đóng góp |
| :---: | --- | --- | --- |
| **1** | **ClaudeKit Engineer** (bộ chính) | [claudekit/claudekit-engineer](https://github.com/claudekit/claudekit-engineer) v2.18.0 | Hooks, statusline, 13 agent quy trình, core skills (`ck:*`), rules, scripts, output-styles. Giấy phép proprietary — đã mua license, kit chỉ dùng nội bộ (repo private) |
| **2** | Superpowers | [obra/superpowers](https://github.com/obra/superpowers) | TDD kỷ luật, `systematic-debugging`, `brainstorming`, `executing-plans`, `finishing-a-development-branch`, `writing-plans` |
| **3** | Everything Claude Code (ECC) | [affaan-m/ecc](https://github.com/affaan-m/ecc) | Hàng trăm skill và sub-agent: Developer, DevOps, Cloud, AI/ML, Swift, Automation |
| **4** | Claude Code Templates | [davila7/claude-code-templates](https://github.com/davila7/claude-code-templates) | Skill/agent .NET, Angular, C#, Cloud/Azure, MCP Dev Team, UI analysis; 103 mẫu MCP |
| **5** | Matt Pocock Skills | [mattpocock/skills](https://github.com/mattpocock/skills) | TypeScript, spec-driven (`to-spec`, `to-tickets`), `domain-modeling`, `ask-matt`, `wizard`, `pr` |
| **6** | Diagram Design | [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design) | 30+ loại sơ đồ với mẫu SVG/HTML |
| **7** | Ponytail | [dietrichgebert/ponytail](https://github.com/dietrichgebert/ponytail) | Code tối giản, chống over-engineering |
| **8** | I Have ADHD | [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) | Trả lời action-first, giảm tải nhận thức |
| **9** | Archify | [tt-a1i/archify](https://github.com/tt-a1i/archify) | Sơ đồ kiến trúc/workflow tương tác HTML/SVG |
| **10** | CodeGraph | [colbymchenry/codegraph](https://github.com/colbymchenry/codegraph) | Đồ thị tri thức mã nguồn cục bộ (Rust + SQLite FTS5); xem [codegraph-guide.md](codegraph-guide.md) |
| **11** | Firecrawl Skills | [firecrawl/skills](https://github.com/firecrawl/skills) | 34 skill chính thức cho Firecrawl CLI/MCP/API: search, scrape, crawl, interact, research/developer index, web-data workflows; thay thế `firecrawl-scraper` cũ; khóa trong `skills-lock.json` |
| **12** | mem0 Skills | [mem0ai/mem0](https://github.com/mem0ai/mem0) | 6 skill chính thức `mem0*` cho memory layer trong AI app/agent: SDK, CLI, Vercel AI SDK, integrate/test/migrate; khóa trong `skills-lock.json` |
| **13** | Browser Use | [browser-use/browser-use](https://github.com/browser-use/browser-use) | Skill chính thức `browser-use` cho browser automation qua CDP/CLI; chỉ cập nhật skill chính để tránh các tên chung như `qa`, `cloud`; khóa trong `skills-lock.json` |

### Ứng viên chờ kiểm thử & tích hợp

Các repository dưới đây **chưa được tích hợp** (hoặc mới tích hợp một phần). Chỉ chuyển lên bảng trên sau khi kiểm thử đạt.

| Ứng viên | Repository | Đánh giá | Trạng thái |
| --- | --- | --- | :---: |
| **Claude Code Toolkit** | [viknesh20-20/claude-code-tool-kit](https://github.com/viknesh20-20/claude-code-tool-kit) | 12 agents, 30 skills, 9 rules, 2 hooks `.sh`, 45+ cấu hình MCP; MIT, 7 sao. Phần lớn trùng kit; hooks `.sh` cần chuyển `.cjs`. Giá trị: cấu hình MCP dựng sẵn, chọn bundle theo loại dự án | Chờ đánh giá |
| **gstack** | [garrytan/gstack](https://github.com/garrytan/gstack) | MIT, 133.6k sao, 53 skill (luồng Think → Plan → Build → Review → Test → Ship). Đã viết lại `careful` + `freeze` bằng Node; bỏ `plan-eng-review`. Rủi ro: cài bằng `./setup` (bash), telemetry opt-in | Đã tích hợp một phần |
| **duthaho/claudekit** | [duthaho/claudekit](https://github.com/duthaho/claudekit) | MIT, 15 skills + 8 agents, verification-first. Chức năng gần `verification-before-completion`, `writing-plans`, `systematic-debugging` — cần so nội dung | Chờ đánh giá |
| **wshobson/agents** | [wshobson/agents](https://github.com/wshobson/agents) | MIT, 94 plugins, 202 agents, 183 skills. 36/137 agent và 26/183 skill trùng tên. Dùng như marketplace theo nhu cầu (`/plugin marketplace add wshobson/agents`) | Không tích hợp |
| **VoltAgent Subagents** | [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) | MIT, 160 agent; 90/160 đã có. Đã tích hợp `ai-engineer`, `data-engineer`, `mlops-engineer`, `llm-architect`, `legacy-modernizer`, `payment-integration`, `workflow-orchestrator`; bỏ `docker-expert`, `git-workflow-manager` (trùng skill) | Đã tích hợp 7 agent |
| **VoltAgent Framework** | [VoltAgent/voltagent](https://github.com/VoltAgent/voltagent) | Framework TypeScript xây AI agent, không phải cấu hình Claude Code | Không tích hợp |

**Tiêu chí nâng lên "đã tích hợp":** có thành phần không trùng kit (so nội dung chức năng, không chỉ so tên), chạy được trên Windows, không ghi đè `settings.json`/hook sẵn có, không kéo theo quyền hoặc thông tin bảo mật, giấy phép cho phép dùng theo cách kit phân phối.

---

## Cập Nhật & Cài Lại Clean

| Việc | Lệnh | Lấy từ đâu |
| --- | --- | --- |
| Lấy bản kit mới của nhóm | `git pull` | GitLab nội bộ |
| Cập nhật nền ClaudeKit | `.\sync-claudekit-base.ps1 -Source <thư mục giải nén>` (hoặc `install-kit.ps1 -Update`; biến `CLAUDEKIT_SOURCE`) | Bản ClaudeKit đã mua |
| Cập nhật các nguồn bổ sung | `.\update-skills.ps1 [-Source claudekit\|mattpocock\|superpowers\|diagramdesign\|ponytail\|adhd\|ecc\|agentskills\|agkit\|codexkit\|firecrawlskills\|mem0\|browseruse\|composio\|nanoclaw]` (hoặc `update-skills.bat`) | Repo upstream |
| Kiểm tra toàn vẹn kit | `node scripts/validate-kit.cjs` (`--fix` để cập nhật số liệu trong tài liệu) | Chạy trong repo kit |
| Kiểm tra installer/statusline | `npm run test:install` · `npm run test:statusline` | Chạy trong repo kit |
| Cập nhật kit trong một dự án | `install-kit.ps1 -Target <dự án>` (giữ `settings.json`) | Kit cục bộ |

**Cập nhật dự án đã cài bản cũ:** chạy `install-kit.ps1 -Target <dự án> -DryRun` để xem trước, rồi chạy không `-DryRun`. Installer tự dọn skill/agent đã gỡ khỏi kit (danh sách: `kit-dropped.json`) và thay hẳn 6 skill trùng tên ClaudeKit (`code-review`, `research`, `frontend-design`, `mcp-builder`, `skill-creator`, `context-engineering`) để không lẫn file cũ; skill/agent tự tạo của dự án giữ nguyên.

Sau khi cập nhật nền ClaudeKit hoặc nguồn bổ sung: chạy `validate-kit`, xem `git status`, rồi commit và push.

**Cài lại clean trong một dự án** (khi cấu hình bị lệch, skill hỏng): xoá `.claude/skills`, `.claude/hooks`, `.claude/agents`, `.claude/scripts`, `.claude/output-styles`, `.claude/schemas` của dự án (giữ `settings.local.json`, `agent-memory/`), rồi chạy lại `agent-install` hoặc `install-kit.ps1 -Target <dự án>`. Thêm `-Force` chỉ khi muốn ghi đè cả `settings.json`, `.ck.json`, `CLAUDE.md`.

## Xử Lý Sự Cố

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
| --- | --- | --- |
| Hook không chạy | Máy thiếu **Git for Windows (Git Bash)** hoặc Node.js 18+ | Cài hai thứ đó; hook thoát êm khi thiếu Node nên trông như "không có gì" |
| Không thấy lệnh `agent-install` | Chưa mở PowerShell mới sau khi cài | Mở cửa sổ PowerShell **mới**; hoặc chạy lại `setup-agent-install-command.ps1 -Force` |
| Claude báo bị chặn đọc thư mục (`node_modules`, `vendor`…) | `scout-block` chặn để tiết kiệm token | Thêm `!<tên thư mục>` vào `.claude/.ckignore` |
| Claude xin phép đọc `.env` | `privacy-block` | Chỉ đồng ý khi cần; hoặc đưa giá trị cần thiết bằng tay |
| Skill không tự xuất hiện | Kit có 800+ skill; danh sách mô tả bị giới hạn (`skillListingBudgetFraction`, `skillListingMaxDescChars` trong `settings.json`) | Gọi thẳng `/tên-skill` hoặc `/ck:find-skills` |
| Hai skill cùng tên | Bản trùng chưa được đổi tên | Chạy `node scripts/validate-kit.cjs`; xem [Quy ước trùng tên](#quy-ước-trùng-tên--claudekit-thắng) |
| MCP/CodeGraph không nạp | Chưa restart sau khi cài | Restart Claude Code; chạy lại `codegraph install --target=claude --location=local --yes` trong dự án |
| `codegraph init` thất bại lúc cài | Không có mạng / CLI chưa cài | Cài CLI rồi chạy `codegraph init` trong dự án |
| Tiếng Việt lỗi font khi chạy script Python | Console không UTF-8 | Đặt `PYTHONIOENCODING=utf-8` |
| Cần xem hook nào lỗi | — | Đọc `.claude/hooks/.logs/hook-log.jsonl` (trường `status`, `error`) |

**An toàn cấu hình:** không đưa credential vào `settings.json`; `settings.local.json` không được commit; không bao giờ copy ngược `settings*.json` từ dự án về kit.

## Tài Nguyên

- [`README.md`](../README.md) — cài đặt, tham số, cấu trúc thư mục
- [`.claude/codegraph-guide.md`](codegraph-guide.md) — quy định bắt buộc dùng CodeGraph
- [`.agents/agents-guide.md`](../.agents/agents-guide.md) — cẩm nang cây `.agents/` (Agent CLI / Codex)
- [`docs/`](../docs/project-overview-pdr.md) và [`guide/SKILLS.md`](../guide/SKILLS.md) — tài liệu của khung ClaudeKit
- [`plans/reports/`](../plans/reports/) — báo cáo kiểm kê skill/agent
- ClaudeKit: <https://docs.claudekit.cc>
