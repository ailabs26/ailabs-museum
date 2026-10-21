# Phase 0 — Chốt quyết định & chuẩn bị VPS

## Mục tiêu
Chốt D1–D7 trong `plan.md`, có VPS sẵn sàng chạy Docker.

## Việc cần làm
1. Chốt D1–D7 và trả lời "Câu hỏi còn mở" trong `plan.md` (domain, đích backup, staging).
2. VPS: Ubuntu LTS, tạo user deploy (không dùng root), SSH key-only, tắt password login.
3. Firewall `ufw`: chỉ mở 22, 80, 443. Lưu ý Docker publish port **bỏ qua ufw** → mọi port nội bộ phải bind `127.0.0.1` hoặc không publish.
4. Cài Docker Engine + Compose plugin (repo chính thức), bật log rotation trong `/etc/docker/daemon.json` (`max-size: 10m`, `max-file: 3`).
5. Bật swap 2 GB (VPS 4 GB RAM build image Vite/Nest dễ OOM).
6. DNS: bản ghi A domain → IP VPS.
7. Bật snapshot định kỳ của nhà cung cấp VPS (nếu có).

## Tiêu chí xong
- `docker run hello-world` chạy bằng user deploy.
- `ufw status` chỉ 22/80/443; domain resolve đúng IP.
