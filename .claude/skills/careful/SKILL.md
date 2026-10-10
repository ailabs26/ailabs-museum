---
name: careful
description: >
  Chế độ an toàn cho lệnh phá hoại: hỏi lại trước rm -rf, DROP TABLE, TRUNCATE,
  git push --force, git reset --hard, git checkout ., kubectl delete, docker
  prune, Remove-Item -Recurse; chặn hẳn xóa đệ quy / hoặc ~ và force-push lên
  main/master. Dùng khi làm việc trên prod, debug hệ thống đang chạy, môi
  trường dùng chung. Kích hoạt khi người dùng nói "careful", "be careful",
  "safety mode", "prod mode", "cẩn thận", "chế độ an toàn".
hooks:
  PreToolUse:
    - matcher: "Bash|PowerShell"
      hooks:
        - type: command
          command: "bash .claude/hooks/node-hook-runner.sh .claude/hooks/careful-check.cjs"
          statusMessage: "Đang kiểm tra lệnh phá hoại..."
---

# /careful — Rào chắn lệnh phá hoại

Chế độ an toàn **đã bật** cho phiên này. Mọi lệnh Bash/PowerShell được kiểm tra trước khi chạy;
gặp lệnh phá hoại, người dùng sẽ được hỏi xác nhận (có thể cho qua từng lệnh).

Hook chỉ tồn tại trong phiên hiện tại. Muốn tắt: kết thúc hoặc bắt đầu phiên mới.

## Được bảo vệ

| Mẫu lệnh | Ví dụ | Mức |
| --- | --- | :---: |
| Xóa đệ quy | `rm -rf ./src`, `Remove-Item -Recurse`, `rd /s`, `del /s` | Hỏi |
| Xóa đệ quy `/`, `~`, `$HOME` (lệnh đơn) | `rm -rf ~` | **Chặn** |
| SQL phá hoại | `DROP TABLE/DATABASE/SCHEMA`, `TRUNCATE` | Hỏi |
| Ghi đè lịch sử | `git push -f`, `--force-with-lease` | Hỏi |
| Force-push nhánh mặc định (lệnh đơn) | `git push -f origin main` | **Chặn** |
| Mất thay đổi chưa commit | `git reset --hard`, `git checkout .`, `git restore .`, `git clean -f` | Hỏi |
| Hạ tầng | `kubectl delete`, `docker rm -f`, `docker system prune` | Hỏi |

**Ngoại lệ không cảnh báo:** xóa đệ quy `node_modules`, `.next`, `dist`, `build`, `coverage`,
`.cache`, `.turbo`, `__pycache__` (chỉ khi *mọi* đích đều nằm trong danh sách này).

## Giới hạn

- Kiểm tra theo chuỗi lệnh: là lớp cảnh báo, **không phải ranh giới bảo mật**.
- "Lệnh đơn" = không chứa `;`, `&`, `|`, xuống dòng. Lệnh ghép chỉ bị hạ xuống mức Hỏi.
- Payload hỏng/không đọc được thì hook hỏi lại (fail-closed), không im lặng cho qua.

Kết hợp với `/freeze` để vừa cảnh báo lệnh nguy hiểm vừa giới hạn phạm vi sửa file.

## Nguồn

Ý tưởng và danh sách mẫu lệnh tham khảo `/careful` của [garrytan/gstack](https://github.com/garrytan/gstack) (MIT),
viết lại bằng Node (`.claude/hooks/careful-check.cjs`) để chạy trên Windows, không cần bash/jq, không telemetry.
