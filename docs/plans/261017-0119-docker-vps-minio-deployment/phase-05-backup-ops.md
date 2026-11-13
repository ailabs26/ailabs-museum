# Phase 5 — Backup, restore, vận hành

## File
- `deploy/backup/backup.sh`, service `backup` trong compose (hoặc cron trên host)
- `docs/architecture/10-deployment.md` (runbook)

## Backup
| Dữ liệu | Cách | Tần suất | Giữ |
|---|---|---|---|
| PostgreSQL | `pg_dump -Fc` → `backups/db/<date>.dump` | Hằng đêm + trước mỗi deploy | 7 ngày + 4 tuần |
| MinIO | `mc mirror --overwrite local/aura-media <đích ngoài VPS>` | Hằng đêm (incremental — file immutable theo UUID nên rẻ) | Theo đích |
| `.env.production`, cert | Lưu ngoài repo (password manager / nơi bảo mật của nhóm) | Khi đổi | — |

Đẩy bản dump DB ra cùng đích ngoài VPS. Backup chỉ trên cùng VPS **không** được tính là backup.

## Restore (phải diễn tập ít nhất 1 lần trước go-live)
1. `docker compose up -d db minio`
2. `pg_restore --clean -d aura_museum <dump>`
3. `mc mirror <đích> local/aura-media`
4. `docker compose up -d` → kiểm tra vài hiện vật có GLB hiển thị.

## Vận hành
- Log: `docker compose logs -f api` (đã giới hạn rotation ở Phase 0).
- Giám sát: uptime check ngoài (vd UptimeRobot/Uptime Kuma) gọi `https://domain/api/health`.
- Cảnh báo disk > 80% (cron `df` + gửi thông báo đơn giản).
- Cập nhật image base & `apt upgrade` định kỳ hằng tháng.

## Tiêu chí xong
- Có ít nhất 1 bản backup DB + MinIO nằm ngoài VPS.
- Diễn tập restore trên máy khác thành công, ghi thời gian thực tế vào runbook.
