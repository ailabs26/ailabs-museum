---
name: freeze
description: >
  Giới hạn Edit/Write chỉ trong một thư mục trong phiên làm việc; sửa file
  ngoài thư mục đó bị chặn. Dùng khi debug để tránh "sửa nhầm" code không liên
  quan, hoặc khi muốn khoanh vùng thay đổi trong một module. Kích hoạt khi
  người dùng nói "freeze", "unfreeze", "chỉ sửa trong thư mục này", "khóa
  phạm vi sửa", "restrict edits", "lock editing scope".
hooks:
  PreToolUse:
    - matcher: "Edit|Write|MultiEdit|NotebookEdit"
      hooks:
        - type: command
          command: "bash .claude/hooks/node-hook-runner.sh .claude/hooks/freeze-check.cjs"
          statusMessage: "Đang kiểm tra ranh giới freeze..."
---

# /freeze — Giới hạn sửa file trong một thư mục

Mọi thao tác Edit/Write/MultiEdit/NotebookEdit vào file **ngoài** thư mục đã chọn sẽ bị **chặn**
(không chỉ cảnh báo). Đọc file, Glob, Grep, Bash không bị ảnh hưởng.

## Đặt ranh giới

1. Hỏi người dùng thư mục cần giới hạn (nhập đường dẫn, không dùng lựa chọn có sẵn).
2. Chạy từ thư mục gốc dự án:

```bash
node .claude/hooks/freeze-check.cjs --set "<thư-mục>"
```

3. Báo lại người dùng: "Chỉ được sửa trong `<thư-mục>`. Chạy `/freeze` lần nữa để đổi, hoặc
   `/freeze` rồi yêu cầu gỡ để bỏ ranh giới."

Lệnh in ra đường dẫn tuyệt đối đã áp dụng. Nếu thư mục không tồn tại, lệnh báo lỗi và không đổi trạng thái.

## Gỡ hoặc xem ranh giới (unfreeze)

```bash
node .claude/hooks/freeze-check.cjs --clear    # gỡ, cho sửa mọi nơi
node .claude/hooks/freeze-check.cjs --status   # xem ranh giới hiện tại
```

Hook vẫn đăng ký trong phiên sau khi gỡ, nhưng cho qua tất cả vì không còn trạng thái.

## Cách hoạt động

- Hook đọc `file_path` (hoặc `notebook_path`) từ payload, giải symlink/tên rút gọn Windows,
  rồi so với thư mục đã đóng băng. Dấu phân cách cuối ngăn `src` khớp nhầm `src-old`.
- Payload không đọc được thì **chặn** (fail-closed). Payload không có đường dẫn file thì cho qua.
- Trạng thái lưu tại `.claude/.freeze-state` (đã ignore khỏi git), giữ nguyên qua các phiên cho tới khi `--clear`.

## Giới hạn

Chỉ chặn công cụ sửa file. Lệnh shell (`sed`, `Set-Content`, `>`...) vẫn ghi được ngoài ranh giới.
Đây là lớp chống sửa nhầm, **không phải ranh giới bảo mật**. Kết hợp `/careful` để cảnh báo lệnh phá hoại.

## Nguồn

Ý tưởng tham khảo `/freeze` của [garrytan/gstack](https://github.com/garrytan/gstack) (MIT),
viết lại bằng Node (`.claude/hooks/freeze-check.cjs`).
