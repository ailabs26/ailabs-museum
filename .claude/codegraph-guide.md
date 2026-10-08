# Hướng Dẫn Toàn Diện CodeGraph & Quy Định Bắt Buộc Dành Cho AI Agent

Tài liệu này là **quy chuẩn bắt buộc** và cẩm nang vận hành chi tiết về **CodeGraph** (`https://github.com/colbymchenry/codegraph`) áp dụng cho toàn bộ các AI Agent (Claude Code, Cursor, Codex, Gemini, Antigravity, GitHub Copilot) và các kỹ sư phần mềm làm việc trong hệ sinh thái dự án của DTSoft.

---

## Mục Lục

1. [Tổng quan về CodeGraph & Tại sao bắt buộc AI Agent phải sử dụng](#1-tổng-quan-về-codegraph--tại-sao-bắt-buộc-ai-agent-phải-sử-dụng)
2. [Quy định BẮT BUỘC dành cho AI Agent (Mandatory Agent Protocols)](#2-quy-định-bắt-buộc-dành-cho-ai-agent-mandatory-agent-protocols)
3. [Quy trình 5 bước chuẩn hóa (SOP) cho AI Agent khi điều tra mã nguồn](#3-quy-trình-5-bước-chuẩn-hóa-sop-cho-ai-agent-khi-điều-tra-mã-nguồn)
4. [Danh mục & Chi tiết các công cụ MCP (`mcp__codegraph__*`)](#4-danh-mục--chi-tiết-các-công-cụ-mcp-mcp__codegraph__)
5. [Danh mục & Chi tiết toàn bộ câu lệnh CLI (`codegraph ...`)](#5-danh-mục--chi-tiết-toàn-bộ-câu-lệnh-cli-codegraph-)
6. [Kịch bản thực chiến trong dự án .NET CQRS Clean Architecture & Angular](#6-kịch-bản-thực-chiến-trong-dự-án-net-cqrs-clean-architecture--angular)
7. [Cấu hình nâng cao (`codegraph.json`) & Biến môi trường](#7-cấu-hình-nâng-cao-codegraphjson--biến-môi-trường)
8. [Xử lý sự cố & Troubleshooting](#8-xử-lý-sự-cố--troubleshooting)
9. [Cơ chế tích hợp tự động trong bộ Kit dtsoft.agent](#9-cơ-chế-tích-hợp-tự-động-trong-bộ-kit-dtsoftagent)

---

## 1. Tổng quan về CodeGraph & Tại sao bắt buộc AI Agent phải sử dụng

### 1.1. CodeGraph là gì?

**CodeGraph** là một công cụ phân tích tĩnh siêu tốc chạy trên **Rust Kernel**, biên dịch toàn bộ cây cú pháp trừu tượng (Abstract Syntax Tree - AST), quan hệ kế thừa, quan hệ phụ thuộc (imports/exports), quan hệ gọi hàm (call edges) và định tuyến web (framework routes) thành một **Đồ thị tri thức (Knowledge Graph)** cục bộ 100%.

Toàn bộ đồ thị được lưu trữ trong thư mục `.codegraph/` tại gốc dự án dưới dạng cơ sở dữ liệu SQLite FTS5 (Full-Text Search), chạy ở chế độ WAL (Write-Ahead Logging) với độ trễ truy vấn dưới 1 mili-giây (sub-millisecond).

```
┌────────────────────────────────────────────────────────────────────────┐
│                              AI AGENT                                  │
│         (Claude Code / Cursor / Codex / Gemini / Antigravity)          │
│                                                                        │
│  "Luồng xử lý từ CreateUserCommand đến cơ sở dữ liệu diễn ra như thế   │
│   nào và ảnh hưởng đến những file nào?"                                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ 1 Tool Call duy nhất (Chính xác 100%)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        CodeGraph MCP Server                            │
│  - Trả về mã nguồn nguyên bản (Verbatim Source) kèm số dòng            │
│  - Vẽ toàn bộ call path (vượt qua interface, dynamic dispatch, DI)     │
│  - Tóm tắt bán kính ảnh hưởng (Blast Radius Summary)                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 SQLite Knowledge Graph (.codegraph/)                   │
│   Rust Tree-Sitter AST · FTS5 Search · Native OS Watcher Auto-Sync     │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.2. Sự khác biệt cốt lõi: CodeGraph vs Grep/Find vs Vector RAG

| Đặc tính | Tìm kiếm truyền thống (`grep` / `find` / `Read`) | Vector Search / RAG (Embeddings) | **CodeGraph (AST Knowledge Graph)** |
| --- | --- | --- | --- |
| **Cơ chế hoạt động** | Khớp chuỗi ký tự thô (Regex/Text) | Tính toán độ tương đồng cosine giữa các vector văn bản | Phân tích AST của trình biên dịch, theo vết con trỏ, symbol và quan hệ thực |
| **Dynamic Dispatch & Interface** | **Thất bại hoàn toàn.** Không thể biết `IOrderRepository` được implement bởi class nào hay được inject ở đâu | Chỉ tìm thấy các đoạn văn bản có từ ngữ tương tự | **Chính xác tuyệt đối.** Giải quyết trực tiếp interface → implementation, MediatR request → handler |
| **Số lần gọi công cụ (Tool Calls)** | Rất lớn (từ **15 - 45 tool calls** cho một câu hỏi kiến trúc) | Trung bình (cần embedding + re-ranking + đọc file) | **Chỉ từ 1 - 3 tool calls** là có đầy đủ câu trả lời |
| **Lượng token tiêu thụ** | Cực kỳ lãng phí (phải nạp toàn bộ nội dung của hàng chục file vào context) | Trung bình (dễ bị vụn vặt và mất ngữ cảnh cha-con) | **Tiết kiệm 60% - 85% token.** Chỉ nạp đúng các hàm và đoạn code liên quan |
| **Độ chính xác ngữ cảnh** | Thấp, dễ nhầm lẫn giữa định nghĩa và lời gọi, phụ thuộc may rủi | Gần đúng (fuzzy), dễ sinh ảo giác (hallucination) | **Chính xác 100%** theo cú pháp của ngôn ngữ |
| **Bảo mật mã nguồn** | Cục bộ | Thường phải gửi code lên server embedding bên ngoài | **100% Cục bộ.** Không gửi bất kỳ byte code nào ra ngoài |

### 1.3. Kết quả đo kiểm thực tế (Benchmarks)

Thử nghiệm trên 7 kho mã nguồn thực tế lớn (VS Code, Excalidraw, Django, Tokio, OkHttp, Gin, Alamofire) đối với các câu hỏi kiến trúc chuyên sâu:

- **Giảm 88% số lần gọi công cụ:** Từ trung bình 28–43 tool calls xuống chỉ còn 1–3 calls.
- **Tốc độ nhanh hơn 53% - 360%:** Thời gian hoàn thành giảm từ 2m42s xuống còn 45s.
- **Tiêu thụ ít hơn 62% tokens:** Loại bỏ hoàn toàn việc đọc dò dẫm từng file.
- **Chi phí rẻ hơn 44% - 78%:** Tiết kiệm ngân sách AI đáng kể.
- **Số file phải đọc thủ công giảm về 0:** CodeGraph trả về sẵn mã nguồn có số dòng tương đương công cụ `Read`.

---

## 2. Quy định BẮT BUỘC dành cho AI Agent (Mandatory Agent Protocols)

> [!IMPORTANT]
> **ĐIỀU KHOẢN BẮT BUỘC:** Khi hoạt động trong bất kỳ thư mục dự án nào có tồn tại thư mục `.codegraph/` (hoặc lệnh `codegraph` đã được cấu hình qua MCP), tất cả AI Agent **BẮT BUỘC PHẢI TUÂN THỦ** các nguyên tắc dưới đây. Bất kỳ hành vi bỏ qua CodeGraph để dùng grep dò dẫm đều bị coi là vi phạm tiêu chuẩn kỹ thuật của DTSoft.

### 2.1. Quy tắc số 1: Zero-Token Wasted Search (Cấm quét dạo)

- **NGHIÊM CẤM** sử dụng vòng lặp `grep` -> `find` -> `view_file`/`Read` file-by-file để tìm kiếm vị trí hàm, class, interface, route API hoặc tìm hiểu luồng hoạt động của hệ thống.
- **BẮT BUỘC** gọi `codegraph_explore` (trên MCP) hoặc chạy `codegraph explore "<câu hỏi hoặc tên symbol>"` (trên terminal/subagent) đầu tiên khi tiếp nhận câu hỏi hoặc nhiệm vụ liên quan đến mã nguồn.

### 2.2. Quy tắc số 2: Trust the AST Result (Tin tưởng tuyệt đối kết quả AST)

- Kết quả trả về từ CodeGraph được xây dựng từ trình phân tích cú pháp (Tree-Sitter parser) của ngôn ngữ thực tế. Do đó, Agent **KHÔNG ĐƯỢC** gọi lại `grep` để "kiểm tra lại" kết quả mà CodeGraph đã cung cấp.
- Việc re-verify bằng grep vừa lãng phí token, vừa chậm chạp, vừa có nguy cơ bỏ sót các nhánh gọi động (dynamic dispatch) mà CodeGraph đã xử lý chuẩn xác.

### 2.3. Quy tắc số 3: Surgical Source Reading (Đọc mã nguồn phẫu thuật)

- Nội dung mã nguồn trả về từ `codegraph_explore` và `codegraph_node` luôn có định dạng `<line_number>\t<content>`.
- Định dạng này hoàn toàn tương đương với công cụ `Read` / `view_file` và **hoàn toàn an toàn để thực hiện `replace_file_content` / `Edit` ngay lập tức**.
- Agent phải coi đoạn mã hiển thị trong kết quả explore là **ĐÃ ĐƯỢC ĐỌC** và không được mở lại file đó chỉ để xem cùng một đoạn code.

### 2.4. Ma trận phân định: Khi nào dùng CodeGraph vs Khi nào dùng Grep/File thường

| Tình huống thực tế | Sử dụng CodeGraph | Sử dụng Grep / Read thường | Lý do kỹ thuật |
| --- | :---: | :---: | --- |
| Tìm hiểu tính năng X hoạt động thế nào | **BẮT BUỘC** | KHÔNG | CodeGraph trả về toàn bộ flow nghiệp vụ trong 1 call |
| Tìm xem ai gọi hàm / class `Y` | **BẮT BUỘC** | KHÔNG | `codegraph_callers` nắm rõ scope và kiểu dữ liệu |
| Tìm xem hàm `Z` gọi tới những thành phần nào | **BẮT BUỘC** | KHÔNG | `codegraph_callees` phân tích chính xác call graph |
| Phân tích tác động (Blast radius) trước khi sửa/xóa symbol | **BẮT BUỘC** | KHÔNG | `codegraph_impact` quét phụ thuộc đa tầng |
| Tìm file test cần chạy lại sau khi sửa code | **BẮT BUỘC** | KHÔNG | `codegraph affected` lần theo import transitive |
| Đọc file cấu hình (`appsettings.json`, `.env`, `angular.json`) | KHÔNG | **DÙNG READ** | File cấu hình không phải AST code, không có quan hệ đồ thị |
| Đọc file tài liệu (`README.md`, `CLAUDE.md`, tài liệu SPD) | KHÔNG | **DÙNG READ** | Tài liệu văn bản thuần túy không sinh ra node/edge |
| Tìm kiếm chuỗi string thô (chuỗi thông báo lỗi, mã màu hex) | KHÔNG | **DÙNG GREP** | CodeGraph tối ưu cho symbol, không index giá trị string literal thô |
| File vừa sửa chưa kịp sync (có cờ cảnh báo staleness) | KHÔNG | **DÙNG READ** | Đọc trực tiếp trên đĩa để đảm bảo số dòng mới nhất |

### 2.5. Hướng dẫn xử lý các cờ cảnh báo (Banners & Flags)

Khi gọi `codegraph_explore` hoặc các công cụ CodeGraph, Agent cần quan sát phần đầu của output để phản ứng chính xác:

1. **Cảnh báo file đang chờ đồng bộ (`⚠️ Some files referenced below were edited since the last index sync...`):**
   - **Ý nghĩa:** Có một số file vừa được ghi lên đĩa nhưng watcher chưa hết thời gian debounce 2 giây để cập nhật vào database.
   - **Hành động của Agent:** Chỉ mở và đọc lại đúng các file được liệt kê trong danh sách cảnh báo này. Toàn bộ các file khác KHÔNG nằm trong danh sách vẫn tươi mới và tin cậy 100%.
2. **Cảnh báo file bị lệch trên đĩa (`⚠ changed on disk after the last index sync`):**
   - **Ý nghĩa:** File đã bị sửa đổi trực tiếp từ bên ngoài mà chưa qua sync. CodeGraph sẽ bảo vệ bằng cách hoặc hiển thị toàn bộ nội dung mới nhất, hoặc bỏ qua đoạn cắt để tránh sai lệch số dòng.
   - **Hành động của Agent:** Đọc riêng file đó bằng công cụ `view_file`/`Read` để xác định số dòng hiện tại.
3. **Cảnh báo Auto-Sync bị tắt (`⚠️ CodeGraph auto-sync is DISABLED...`):**
   - **Ý nghĩa:** Watcher bị vô hiệu hóa (do môi trường container, biến `CODEGRAPH_NO_DAEMON=1` hoặc lỗi socket).
   - **Hành động của Agent:** Chạy lệnh `codegraph sync` từ terminal, hoặc chuyển sang đọc file trực tiếp nếu không thể sync.
4. **Thông báo chưa index (`No .codegraph/ directory found`):**
   - **Ý nghĩa:** Thư mục hiện tại chưa được khởi tạo CodeGraph.
   - **Hành động của Agent:** Dừng việc gọi các công cụ CodeGraph trên thư mục này, chuyển sang dùng các công cụ built-in chuẩn. Không tự ý chạy `codegraph init` nếu người dùng chưa yêu cầu.

---

## 3. Quy trình 5 bước chuẩn hóa (SOP) cho AI Agent khi điều tra mã nguồn

Khi nhận một nhiệm vụ thêm mới tính năng, sửa lỗi (bug fix), tái cấu trúc (refactoring) hoặc phân tích hệ thống, AI Agent phải thực hiện tuần tự theo quy trình sau:

```
  ┌───────────────────────────────────────────────────────────┐
  │ Bước 1: Khảo sát & Định vị (Survey & Exploration)         │
  │ codegraph_explore { query: "<câu hỏi hoặc symbol>" }      │
  └─────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
  ┌───────────────────────────────────────────────────────────┐
  │ Bước 2: Truy vết luồng nghiệp vụ (Flow Tracing)           │
  │ codegraph_explore { query: "SymbolStart SymbolEnd" }      │
  │ hoặc codegraph_callers / codegraph_callees                │
  └─────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
  ┌───────────────────────────────────────────────────────────┐
  │ Bước 3: Phân tích bán kính ảnh hưởng (Blast Radius)       │
  │ codegraph_impact { symbol: "TargetSymbol", depth: 2 }     │
  └─────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
  ┌───────────────────────────────────────────────────────────┐
  │ Bước 4: Sửa đổi chính xác tại đích (Surgical Edits)        │
  │ Thực hiện sửa code theo đúng số dòng & phạm vi đã phân tích│
  └─────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
  ┌───────────────────────────────────────────────────────────┐
  │ Bước 5: Xác định kiểm thử bị ảnh hưởng (Verification)     │
  │ git diff --name-only | codegraph affected --stdin         │
  └───────────────────────────────────────────────────────────┘
```

### Bước 1: Khảo sát & Định vị (Survey & Exploration)

- Khi bắt đầu tìm hiểu một module hoặc tính năng, gửi một câu hỏi tự nhiên hoặc danh sách các symbol chính vào `codegraph_explore`.
- *Ví dụ:* `codegraph_explore { query: "Lớp xác thực người dùng JwtAuthService đăng nhập như thế nào" }` hoặc `codegraph_explore { query: "CreateOrderCommand OrderHandler Order" }`.
- Kết quả nhận được ngay lập tức: vị trí file, định nghĩa class, phương thức kèm mã nguồn và số dòng.

### Bước 2: Truy vết luồng nghiệp vụ (Flow Tracing)

- Nếu cần hiểu cách dữ liệu di chuyển từ đầu vào (API endpoint / Controller / UI Event) tới cơ sở dữ liệu (Repository / DbContext):
- Gọi `codegraph_explore` kèm tên của 2 symbol ở 2 đầu luồng:
  *Ví dụ:* `codegraph_explore { query: "OrderController SaveOrderAsync" }`.
- CodeGraph sẽ tự động tìm đường đi ngắn nhất trên đồ thị, nhảy qua các interface, MediatR pipeline, event subscriber và trả về chi tiết toàn bộ các mắt xích ở giữa.

### Bước 3: Phân tích bán kính ảnh hưởng (Blast Radius)

- Trước khi sửa đổi một hàm, đổi tên một property trong Entity/DTO, hoặc thay đổi chữ ký hàm:
- Gọi `codegraph_impact { symbol: "TênSymbol", depth: 2 }` (hoặc chạy CLI: `codegraph impact TênSymbol -d 2`).
- Agent sẽ thấy toàn bộ danh sách các class, method, component đang phụ thuộc vào symbol đó để chủ động sửa đồng bộ, tránh lỗi biên dịch (build error).

### Bước 4: Sửa đổi chính xác tại đích (Surgical Edits)

- Sử dụng trực tiếp số dòng và nội dung code trả về từ Bước 1, 2, 3 để thực hiện lệnh edit (`replace_file_content`).
- Tuyệt đối không cần gọi lại `view_file` chỉ để lấy lại số dòng của file đã nằm trong kết quả explore.

### Bước 5: Xác định kiểm thử bị ảnh hưởng (Verification)

- Sau khi hoàn thành việc chỉnh sửa mã nguồn:
- Chạy lệnh CLI: `codegraph affected --stdin` kết hợp với `git diff` để biết chính xác những file unit test / integration test nào bị ảnh hưởng.
- Chỉ chạy kiểm thử cho các file bị ảnh hưởng thay vì chạy mù toàn bộ solution hàng nghìn test case.

---

## 4. Danh mục & Chi tiết các công cụ MCP (`mcp__codegraph__*`)

CodeGraph đăng ký vào hệ thống Agent dưới dạng các công cụ MCP (Model Context Protocol). Theo cấu hình tối ưu của CodeGraph, mặc định chỉ có `codegraph_explore` được kích hoạt sẵn để Agent tập trung context, các công cụ chuyên biệt khác có thể được bật qua biến môi trường `CODEGRAPH_MCP_TOOLS` hoặc luôn khả dụng qua lệnh CLI.

### 4.1. `codegraph_explore` (Công cụ chủ đạo - PRIMARY TOOL)

> **Mô tả:** Công cụ quan trọng nhất. Trả về mã nguồn nguyên bản có đánh số dòng của các symbol liên quan, gom nhóm theo từng file, kèm theo toàn bộ đường đi của lời gọi (call path) và tóm tắt bán kính ảnh hưởng (blast radius) trong **ĐÚNG 1 LƯỢT GỌI**. Hỗ trợ cả câu hỏi bằng ngôn ngữ tự nhiên lẫn danh sách từ khóa/symbol.

#### Schema tham số

```json
{
  "query": {
    "type": "string",
    "description": "Câu hỏi ngôn ngữ tự nhiên, tên các symbol, tên file hoặc thuật ngữ code. Ví dụ: 'UserService Authenticate', 'AuthHandler token.ts', 'Cách tính tổng tiền trong InvoiceCalculator'."
  },
  "maxFiles": {
    "type": "number",
    "description": "Số lượng file tối đa trả về mã nguồn chi tiết. Mặc định là 12 (tự động điều chỉnh theo kích thước dự án).",
    "default": 12
  },
  "projectPath": {
    "type": "string",
    "description": "Đường dẫn đến thư mục dự án (sử dụng khi làm việc trong monorepo hoặc muốn tra cứu dự án khác có .codegraph/)."
  }
}
```

#### Ví dụ truy vấn

```typescript
// 1. Khảo sát luồng nghiệp vụ giữa 2 điểm
codegraph_explore({
  query: "CreateInvoiceCommand Handle InvoiceRepository"
});

// 2. Tìm hiểu một tính năng cụ thể bằng ngôn ngữ tự nhiên
codegraph_explore({
  query: "Hệ thống phân quyền RolePermission được cấu hình và kiểm tra ở đâu"
});

// 3. Đọc mã nguồn của một class cụ thể kèm theo ai gọi nó
codegraph_explore({
  query: "InvoiceService.cs CalculateTotal"
});
```

---

### 4.2. `codegraph_node` (Đọc file hoặc đọc Symbol chuyên sâu)

> **Mô tả:** Có 2 chế độ hoạt động mạnh mẽ:
>
> 1. **Chế độ đọc File (File Mode):** Thay thế hoàn toàn công cụ `Read`. Truyền `file` (đường dẫn hoặc tên file) và KHÔNG truyền `symbol`. Trả về mã nguồn nguyên bản có số dòng `<n>\t<line>` kèm theo danh sách các file khác đang phụ thuộc vào file này.
> 2. **Chế độ đọc Symbol (Symbol Mode):** Truyền `symbol` (kèm `includeCode: true` nếu muốn lấy body). Trả về vị trí định nghĩa, chữ ký hàm, danh sách callers và callees trực tiếp.

#### Schema tham số

```json
{
  "symbol": {
    "type": "string",
    "description": "Tên của symbol cần tra cứu (để trống nếu muốn đọc cả file)."
  },
  "file": {
    "type": "string",
    "description": "Tên file hoặc đường dẫn file (ví dụ: 'OrderService.cs', 'src/auth/jwt.ts')."
  },
  "includeCode": {
    "type": "boolean",
    "description": "Trong Symbol Mode: lấy toàn bộ thân hàm/code (mặc định: false).",
    "default": false
  },
  "offset": {
    "type": "number",
    "description": "Trong File Mode: dòng bắt đầu đọc (1-indexed), tương tự như Read."
  },
  "limit": {
    "type": "number",
    "description": "Trong File Mode: số dòng tối đa cần đọc (mặc định tối đa 2000 dòng)."
  },
  "symbolsOnly": {
    "type": "boolean",
    "description": "Trong File Mode: chỉ trả về danh mục các symbol trong file mà không lấy source code.",
    "default": false
  },
  "line": {
    "type": "number",
    "description": "Số dòng để chỉ định chính xác định nghĩa khi có nhiều hàm trùng tên (overload)."
  },
  "projectPath": {
    "type": "string",
    "description": "Đường dẫn dự án mục tiêu."
  }
}
```

#### Ví dụ truy vấn

```typescript
// Đọc mã nguồn file thay cho công cụ Read truyền thống:
codegraph_node({
  file: "api/Dtsoft.Edu.Application/Features/Students/StudentService.cs",
  offset: 1,
  limit: 100
});

// Tra cứu chi tiết một method bị overload:
codegraph_node({
  symbol: "ProcessPayment",
  file: "PaymentGateway.cs",
  includeCode: true
});
```

---

### 4.3. `codegraph_search` (Tìm kiếm Symbol theo tên)

> **Mô tả:** Tìm kiếm nhanh vị trí khai báo của các symbol theo tên hoặc tên bán phần. Trả về vị trí file, số dòng, loại symbol (không trả về code). Rất hữu ích khi chỉ muốn kiểm tra xem một class hay method có tồn tại hay không.

#### Schema tham số

```json
{
  "query": {
    "type": "string",
    "description": "Tên symbol hoặc một phần tên (ví dụ: 'Auth', 'StudentDto', 'GetById')."
  },
  "kind": {
    "type": "string",
    "enum": ["function", "method", "class", "interface", "type", "variable", "route", "component"],
    "description": "Lọc theo loại node cú pháp."
  },
  "limit": {
    "type": "number",
    "description": "Số lượng kết quả tối đa (mặc định: 10).",
    "default": 10
  },
  "projectPath": { "type": "string" }
}
```

---

### 4.4. `codegraph_callers` & `codegraph_callees` (Truy vết Lời Gọi)

> **Mô tả:**
>
> - `codegraph_callers`: Tìm tất cả những hàm/phương thức/class đang **GỌI** tới symbol mục tiêu.
> - `codegraph_callees`: Tìm tất cả những hàm/phương thức mà symbol mục tiêu đang **GỌI TỚI**.

#### Schema tham số

```json
{
  "symbol": {
    "type": "string",
    "description": "Tên hàm, method hoặc class cần tra cứu."
  },
  "file": {
    "type": "string",
    "description": "Định vị file cụ thể nếu có nhiều symbol trùng tên."
  },
  "limit": {
    "type": "number",
    "description": "Số lượng kết quả tối đa (mặc định: 20).",
    "default": 20
  },
  "projectPath": { "type": "string" }
}
```

---

### 4.5. `codegraph_impact` (Phân tích Bán Kính Ảnh Hưởng - Blast Radius)

> **Mô tả:** Đi sâu vào cây phụ thuộc theo chiều sâu `depth` để xác định toàn bộ những file, class, method nào sẽ bị ảnh hưởng nếu chúng ta thay đổi cấu trúc của symbol mục tiêu. Bắt buộc sử dụng trước các tác vụ Refactoring lớn.

#### Schema tham số

```json
{
  "symbol": {
    "type": "string",
    "description": "Tên symbol sắp sửa đổi."
  },
  "file": {
    "type": "string",
    "description": "File chứa symbol mục tiêu."
  },
  "depth": {
    "type": "number",
    "description": "Độ sâu duyệt đồ thị phụ thuộc (mặc định: 2).",
    "default": 2
  },
  "projectPath": { "type": "string" }
}
```

---

### 4.6. `codegraph_files` & `codegraph_status`

- **`codegraph_files`:** Liệt kê cây thư mục các file mã nguồn đã được index kèm theo thống kê ngôn ngữ và số lượng symbol. Chạy nhanh hơn lệnh `find`/`glob` thông thường rất nhiều vì dữ liệu đã nằm sẵn trong SQLite.
  - Tham số: `path` (thư mục con), `pattern` (glob như `*.cs`, `*.ts`), `format`.
- **`codegraph_status`:** Kiểm tra tình trạng sức khỏe của index: tổng số file, tổng số node, tổng số edge quan hệ, trạng thái SQLite Journal (`wal`), và danh sách các file đang chờ đồng bộ (`pending sync`).

---

## 5. Danh mục & Chi tiết toàn bộ câu lệnh CLI (`codegraph ...`)

Tất cả các chức năng của CodeGraph đều có thể thực thi trực tiếp từ terminal hoặc từ các subagent thông qua CLI `codegraph`:

### 5.1. Bảng tham chiếu các lệnh CLI

| Lệnh CLI | Chức năng chính | Các cờ (Flags) quan trọng |
| --- | --- | --- |
| `codegraph init [path]` | Khởi tạo `.codegraph/` và lập chỉ mục toàn bộ dự án | `-i, --interactive` (hỏi tùy chọn), `-q, --quiet` |
| `codegraph install` | Cấu hình MCP Server vào các Agent (Claude, Cursor, Codex, v.v.) | `--target=claude,cursor`, `--location=local/global`, `--yes` |
| `codegraph explore <query>` | Khảo sát luồng và lấy source code nguyên bản | `--json`, `--max-files <n>` |
| `codegraph node <symbol\|file>` | Đọc chi tiết symbol hoặc đọc toàn bộ file có số dòng | `--include-code`, `--offset <n>`, `--limit <n>` |
| `codegraph callers <symbol>` | Liệt kê tất cả caller gọi tới symbol | `--limit <n>`, `--json`, `--file <path>` |
| `codegraph callees <symbol>` | Liệt kê tất cả callee mà symbol gọi tới | `--limit <n>`, `--json`, `--file <path>` |
| `codegraph impact <symbol>` | Phân tích các thành phần bị ảnh hưởng khi sửa symbol | `-d, --depth <n>`, `--json` |
| `codegraph affected [files...]` | **Truy vết các file test bị ảnh hưởng** | `--stdin`, `-d, --depth <n>`, `-q, --quiet`, `-j, --json` |
| `codegraph files [path]` | Hiển thị cấu trúc file đã index kèm số lượng symbol | `--filter <glob>`, `--max-depth <n>`, `--json` |
| `codegraph query <search>` | Tìm kiếm nhanh symbol trong database FTS5 | `--kind <type>`, `--limit <n>`, `--json` |
| `codegraph sync [path]` | Đồng bộ thủ công các file mới sửa vào đồ thị | `-q, --quiet` |
| `codegraph index [path]` | Quét lại toàn bộ đồ thị từ đầu (Re-index) | `--force` (xóa index cũ làm lại), `--quiet` |
| `codegraph status [path]` | Báo cáo chi tiết số node, edge, trạng thái WAL | Không có cờ phụ |
| `codegraph unlock [path]` | Gỡ bỏ stale lock file khi tiến trình trước bị treo đột ngột | Không có cờ phụ |
| `codegraph daemon` | Quản lý các tiến trình daemon chạy ngầm | Alias: `daemons` |
| `codegraph telemetry [on\|off]` | Bật hoặc tắt gửi dữ liệu thống kê ẩn danh | Không có cờ phụ |
| `codegraph upgrade [version]` | Tự động cập nhật phiên bản CLI mới nhất | `--check` (kiểm tra trước), `--force` |
| `codegraph uninstall` | Gỡ bỏ cấu hình MCP khỏi Agent và gỡ bỏ CLI | `--keep-cli` (chỉ gỡ MCP, giữ CLI), `--yes` |

---

### 5.2. Chuyên đề đặc biệt: `codegraph affected` cho Kiểm thử Chọn lọc (Selective Testing)

Thông thường trong các dự án lớn, một thay đổi nhỏ có thể khiến kỹ sư hoặc CI phải chạy lại toàn bộ test suite mất hàng chục phút. `codegraph affected` lần theo đồ thị import transitive để chỉ ra **chính xác những file test nào chịu tác động**:

```bash
# 1. Kiểm tra các file test bị ảnh hưởng bởi 2 file mã nguồn cụ thể:
codegraph affected src/StudentService.cs src/StudentValidator.cs

# 2. Kết hợp với Git Diff để phát hiện toàn bộ test bị ảnh hưởng trong nhánh hiện tại:
git diff --name-only origin/master...HEAD | codegraph affected --stdin

# 3. Kịch bản chạy Test tự động siêu tốc cho .NET / Angular:
AFFECTED_TESTS=$(git diff --name-only | codegraph affected --stdin --quiet --filter "**/*Tests.cs")
if [ -n "$AFFECTED_TESTS" ]; then
    dotnet test --filter "FullyQualifiedName~$AFFECTED_TESTS"
fi
```

---

## 6. Kịch bản thực chiến trong dự án .NET CQRS Clean Architecture & Angular

Bộ kit `dtsoft.agent` chuyên dụng cho các dự án **.NET CQRS Clean Architecture** kết hợp **Angular**. Dưới đây là các kịch bản thực tế mà AI Agent bắt buộc phải áp dụng CodeGraph để thao tác chính xác:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      KIẾN TRÚC .NET CQRS TẠI DTSOFT                     │
│                                                                         │
│  [Angular UI] ──HTTP──> [API Controller]                                │
│                              │                                          │
│                         MediatR.Send()                                  │
│                              │                                          │
│                              ▼                                          │
│                  [Command / Query Request]                              │
│                              │                                          │
│                   IRequestHandler<TRequest>                             │
│                              │                                          │
│                              ▼                                          │
│                      [Command Handler]                                  │
│                       /              \                                  │
│                      ▼                ▼                                 │
│             [AutoMapper Profile]   [Repository / DbContext]             │
│                      │                        │                         │
│                      ▼                        ▼                         │
│                  [DTO Model]            [Domain Entity]                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.1. Kịch bản 1: Truy vết toàn bộ luồng xử lý của một API nghiệp vụ

**Yêu cầu:** Người dùng yêu cầu: *"Kiểm tra luồng tạo mới sinh viên `CreateStudent` trong backend hoạt động ra sao và đang lưu những thông tin gì?"*

❌ **Cách làm sai (Dò dẫm bằng Grep/Read):**

1. Gọi `grep` tìm `CreateStudent` ra 150 kết quả.
2. Mở file `StudentController.cs` đọc controller.
3. Thấy controller gọi `_mediator.Send(command)`.
4. Lại gọi `grep` tìm `CreateStudentCommand` để xem thuộc tính.
5. Lại gọi `grep` tìm `CreateStudentCommandHandler` để đọc xử lý.
6. Lại gọi `grep` tìm `IStudentRepository` xem hàm `AddAsync`.
7. Mất hơn **15 tool calls** và hơn **30.000 tokens**.

✅ **Cách làm chuẩn bằng CodeGraph (1 Tool Call duy nhất):**

```typescript
codegraph_explore({
  query: "StudentController CreateStudentCommand CreateStudentCommandHandler Student"
})
```

CodeGraph sẽ trả về ngay trong 1 payload:

- Thân hàm trong `StudentController.cs` với annotation `[HttpPost]`.
- Class `CreateStudentCommand.cs` với các properties.
- Toàn bộ phương thức `Handle` trong `CreateStudentCommandHandler.cs`.
- Mối liên kết tới `IStudentRepository` và Entity `Student.cs`.
- Đường đi các lời gọi và số dòng chính xác để làm việc ngay.

---

### 6.2. Kịch bản 2: Thêm trường dữ liệu mới vào Entity và đánh giá tác động

**Yêu cầu:** Người dùng yêu cầu: *"Bổ sung trường `string CitizenId { get; set; }` vào bảng `Student` và cập nhật tất cả những chỗ liên quan."*

**Quy trình thực hiện của Agent:**

1. **Bước 1: Khảo sát cấu trúc hiện tại của `Student`:**

   ```typescript
   codegraph_explore({ query: "Student.cs StudentDto.cs StudentMappingProfile.cs" })
   ```

2. **Bước 2: Phân tích bán kính ảnh hưởng của Entity `Student`:**

   ```typescript
   codegraph_impact({ symbol: "Student", depth: 2 })
   ```

   Kết quả sẽ liệt kê chính xác các file chịu ảnh hưởng:
   - `StudentDto.cs` & `CreateStudentDto.cs`
   - `StudentMappingProfile.cs` (cấu hình mapping giữa Entity và DTO)
   - `CreateStudentCommandValidator.cs` (cần bổ sung rule validate căn cước công dân)
   - `StudentDbContext.cs` (cấu hình OnModelCreating / Fluent API)
   - `IStudentRepository.cs`
3. **Bước 3: Chỉnh sửa chính xác từng file** dựa trên số dòng trả về từ các bước trên mà không cần phải grep dò dẫm.

---

### 6.3. Kịch bản 3: Truy vết từ giao diện Angular về API Backend

**Yêu cầu:** Người dùng báo: *"Nút bấm 'Lưu học sinh' trên màn hình `student-edit.component.ts` đang gọi API nào và payload gửi đi gồm những gì?"*

**Cách thực hiện của Agent:**

```typescript
codegraph_explore({
  query: "student-edit.component.ts StudentService saveStudent"
})
```

CodeGraph tự động phát hiện quan hệ dependency injection của Angular:

- Bắt được component inject `StudentService`.
- Phương thức `onSave()` trong component gọi `this.studentService.create(data)`.
- Nhìn thấy endpoint `POST /api/v1/students` trong `StudentService`.
- Nếu có backend trong cùng workspace, CodeGraph liên kết URL pattern này trực tiếp tới `[HttpPost]` action trong `StudentsController.cs`.

---

## 7. Cấu hình nâng cao (`codegraph.json`) & Biến môi trường

### 7.1. File cấu hình `codegraph.json` tại thư mục gốc dự án

Mặc dù CodeGraph hoạt động ở chế độ **Zero-Config** (tự động nhận diện 30+ ngôn ngữ, tự động loại trừ `node_modules`, `bin`, `obj`, `dist`, `.git`), bạn có thể tinh chỉnh các hành vi đặc biệt thông qua file `codegraph.json`:

```json
{
  "exclude": [
    "static/themes/",
    "docs/swagger-static/",
    "**/generated/**"
  ],
  "include": [
    "Tools/CustomScripts/"
  ],
  "deprioritize": [
    "scripts/",
    "tests/helpers/"
  ],
  "extensions": {
    ".dota_lua": "lua",
    ".tpl": "php",
    ".inc": "csharp"
  }
}
```

- **`exclude`:** Loại bỏ các thư mục đã commit vào Git nhưng không muốn nạp vào đồ thị (ví dụ theme frontend đã build, thư mục mã tự động sinh).
- **`include`:** Ép buộc CodeGraph phải index những thư mục vốn bị `.gitignore` chặn (ví dụ các thư mục tool phụ trợ nội bộ).
- **`deprioritize`:** Giữ các thư mục trong đồ thị nhưng hạ điểm xếp hạng tìm kiếm. Khi tìm kiếm, các hàm trong code nghiệp vụ chính sẽ luôn hiển thị trước các hàm tiện ích trong `scripts/` hoặc `tests/helpers/`.
- **`extensions`:** Ánh xạ các phần mở rộng file không chuẩn vào bộ phân tích cú pháp tương ứng.

---

### 7.2. Các biến môi trường (Environment Variables) điều khiển

| Biến môi trường | Giá trị mặc định | Mô tả chi tiết |
| --- | --- | --- |
| `CODEGRAPH_MCP_TOOLS` | `explore` | Danh sách công cụ MCP kích hoạt cho Agent. Ví dụ đặt: `explore,node,search,callers,callees,impact` để mở toàn bộ công cụ. |
| `CODEGRAPH_NO_DAEMON` | `0` | Đặt thành `1` để tắt daemon nền (hữu ích trong CI hoặc môi trường sandbox hạn chế chia sẻ Unix domain socket / Named Pipe). |
| `CODEGRAPH_DIR` | `.codegraph` | Đổi tên thư mục chứa database. Bắt buộc sử dụng khi chia sẻ cùng một mã nguồn giữa Windows và WSL2 (ví dụ trên Windows đặt `CODEGRAPH_DIR=.codegraph-win`). |
| `CODEGRAPH_TELEMETRY` | `1` (hỏi khi cài) | Đặt thành `0` để tắt hoàn toàn việc gửi dữ liệu thống kê sử dụng ẩn danh. |
| `CODEGRAPH_WAL_VALVE_MB` | `256` | Ngưỡng dung lượng soft của file `-wal` (SQLite) trong quá trình index repo khổng lồ trước khi kích hoạt gộp dữ liệu. |
| `CODEGRAPH_WAL_HEAL_MB` | `64` | Ngưỡng co gọn file `-wal` về trạng thái nghỉ sau khi hoàn thành phiên làm việc. |

---

## 8. Xử lý sự cố & Troubleshooting

### 8.1. Lỗi "Database is locked" hoặc file lock bị kẹt

- **Hiện tượng:** Khi chạy lệnh index hoặc khi Agent gọi MCP, nhận được thông báo lỗi `database is locked` hoặc `Another process is currently indexing`.
- **Nguyên nhân:** Tiến trình trước đó bị tắt đột ngột (tắt máy tính, kill terminal) khi chưa kịp giải phóng lock.
- **Cách khắc phục:**

  ```bash
  # Chạy lệnh giải phóng lock chính chủ của CodeGraph:
  codegraph unlock

  # Hoặc xóa file writer.pid thủ công nếu có:
  rm .codegraph/writer.pid
  ```

### 8.2. Môi trường kết hợp Windows và WSL2

- **Vấn đề:** Không bao giờ để cả Windows lẫn WSL2 cùng đọc/ghi vào chung một thư mục `.codegraph/` nằm trên ổ đĩa Windows (`/mnt/c` hoặc `/mnt/d`). Cơ chế khóa tệp của SQLite qua ranh giới WSL2-Windows 9P filesystem không ổn định và có thể gây nghẽn kết nối.
- **Cách giải quyết:**
  - Trên Windows PowerShell: Sử dụng mặc định `.codegraph` hoặc thiết lập `$env:CODEGRAPH_DIR=".codegraph-win"`.
  - Trên WSL2: Thiết lập `export CODEGRAPH_DIR=".codegraph"`. CodeGraph tự động bỏ qua các thư mục anh em có tiền tố `.codegraph-*`.

### 8.3. Khi nào cần chạy lại toàn bộ Index (`codegraph index --force`)?

Auto-sync chạy nền của CodeGraph hoạt động bền bỉ, tuy nhiên trong các trường hợp sau bạn nên chạy lại một lần:

1. Vừa thực hiện `git checkout` một nhánh lớn hoặc `git reset --hard` hàng nghìn file.
2. Vừa bổ sung hoặc thay đổi quy tắc ánh xạ trong `codegraph.json`.
3. Vừa nâng cấp phiên bản CodeGraph CLI (`codegraph upgrade`).

---

## 9. Cơ chế tích hợp tự động trong bộ Kit dtsoft.agent

Bộ kit `dtsoft.agent/agent` đã được thiết kế sẵn để tích hợp CodeGraph một cách hoàn toàn tự động vào mọi dự án khi cài đặt:

1. **Kiểm tra & Cài đặt tự động:** Script `install-kit.ps1` tự động kiểm tra xem máy đã có CLI `codegraph` chưa. Nếu chưa, script sẽ tải trực tiếp bản binary chính thức từ `https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.ps1`.
2. **Khởi tạo đồ thị:** `install-kit.ps1` tự động gọi `codegraph init $Target -i` để xây dựng đồ thị ngay khi cài đặt kit.
3. **Đăng ký MCP Server:** Tự động thực thi `codegraph install --target=claude --location=local --yes` để cấu hình `.mcp.json` gắn trực tiếp CodeGraph vào Agent.
4. **Cấp quyền tự động (Auto-allow):** File `.claude/settings.json` trong kit đã cấu hình sẵn quyền `"permissions.allow": ["mcp__codegraph__*"]`, cho phép AI Agent gọi các công cụ CodeGraph mà không cần làm phiền người dùng phải bấm xác nhận mỗi lần.
5. **Prompt Hook:** Hook `UserPromptSubmit` tự động kích hoạt `codegraph prompt-hook` để duy trì ngữ cảnh tươi mới nhất.

---

> [!TIP]
> **Lời khuyên vàng cho kỹ sư & AI Agent:**
> *"Trước khi viết dòng mã đầu tiên, hãy để CodeGraph vẽ cho bạn bức tranh toàn cảnh của hệ thống. 1 lệnh explore chuẩn xác đáng giá hơn 100 lần grep mò mẫm."*
