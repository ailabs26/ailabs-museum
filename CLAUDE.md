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

<!-- Ngôn ngữ, framework, database -->

## Cấu trúc

<!-- Các thư mục chính và vai trò -->

## Lệnh

<!-- build / test / lint / run -->

## Quy ước

<!-- Naming, format response, error handling -->

<!-- CODEGRAPH_START -->
## CodeGraph (BẮT BUỘC / MANDATORY)

Khi làm việc trong kho mã nguồn đã có thư mục `.codegraph/`, AI Agent BẮT BUỘC PHẢI DÙNG CodeGraph trước khi dùng grep/find hoặc đọc file thủ công:
- **MCP Tool (Khuyên dùng):** Gọi `codegraph_explore` để trả lời câu hỏi cấu trúc, luồng code, và symbol trong 1 lượt gọi duy nhất — trả về verbatim source kèm call paths và blast radius.
- **Terminal / Subagent:** `codegraph explore "<symbol names hoặc câu hỏi>"` cho kết quả tương tự.
- **Hướng dẫn chi tiết:** Xem `.claude/codegraph-guide.md`.
<!-- CODEGRAPH_END -->

## Ghi chú riêng của dự án

<!-- Bổ sung quy ước, lưu ý, gotcha của dự án tại đây -->
