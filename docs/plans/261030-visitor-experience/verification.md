# Bằng chứng kiểm chứng

## Baseline (trước source edits)

- Working tree sạch; nhánh ban đầu dev; remote SSH `git@github.com:ailabs26/ailabs-museum.git`.
- Fetch origin/dev thành công; base a9591858d77312a36efb5b6e891ea400d55ac94f. Nhánh mới feat/visitor-experience-toolkit.
- `npm run ...` bị PowerShell ExecutionPolicy chặn npm.ps1, exit 1; dùng npm.cmd như README, không thay policy/config.
- `npm.cmd run typecheck`: PASS exit 0.
- `npm.cmd run lint`: PASS exit 0, 1 warning CollectionPage:29 exhaustive-deps vì exhibits được tạo lại.
- `npm.cmd run test:unit`: PASS exit 0, 33 files / 179 tests.
- `npm.cmd run build`: PASS exit 0; main 1.008,73 kB (gzip 305,25 kB), CSS 253,45 kB; cảnh báo chunks >500 kB đã có sẵn.
- Đã đọc Playwright config: fixtures + Edge Windows, port 4173, workers 1; live tests opt-in, không tự khởi động API/database.

## Nhật ký thực thi

Sẽ ghi RED/GREEN, lệnh, exit code, counts, review findings và giới hạn tại đây.
