# Phase 6 — CI/CD + checklist go-live

## CI/CD (tùy chọn, P2)
- GitHub Actions khi merge `main`: typecheck + lint + test → build image `api`, `web` → push GHCR (tag = commit SHA).
- Deploy: SSH vào VPS → backup DB → `docker compose pull && docker compose up -d` (migrate tự chạy trước api).
- Rollback: đổi tag image về SHA trước đó + `up -d`. Migration chỉ tiến → cần migration có `down` tương ứng hoặc restore DB.
- Secret CI: SSH key deploy, token GHCR — lưu ở GitHub Environments `production` có required reviewer.

## Checklist go-live
- [ ] Mọi secret (`JWT_ACCESS_SECRET`, `MEDIA_URL_SIGNING_SECRET`, mật khẩu DB, MinIO root/app) đã sinh mới, không phải giá trị mẫu
- [ ] `NODE_ENV=production`, Swagger tắt, cookie `secure`
- [ ] Chỉ 22/80/443 mở ra ngoài; MinIO console không public
- [ ] HTTPS + HSTS, redirect HTTP → HTTPS
- [ ] Migration đã chạy, seed admin đầu tiên (`seed:prod`) rồi xóa `SEED_ADMIN_PASSWORD` khỏi env
- [ ] Upload GLB → preview (signed URL) → publish → public xem được → unpublish → 404 ngay
- [ ] Audit log ghi đúng IP client
- [ ] Backup chạy, diễn tập restore xong
- [ ] Uptime check + cảnh báo disk hoạt động
- [ ] `docs/architecture/10-deployment.md` cập nhật, cập nhật `08-usecase-and-diagrams.md` (deployment diagram: thay "public/ hoặc Supabase Storage" bằng MinIO)
