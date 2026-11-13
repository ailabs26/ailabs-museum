#!/usr/bin/env bash
# Backup logic (pg_dump -Fc) DB trong back-end/.env, kiểm tra tính đọc được, giữ N ngày gần nhất.
#
#   tools/db/backup.sh                       # ghi vào ~/aura-backups, giữ 14 ngày
#   BACKUP_DIR=/mnt/usb/aura KEEP_DAYS=30 tools/db/backup.sh
#   DATABASE_URL=postgres://... tools/db/backup.sh
#
# Chỉ đọc DB. URL/mật khẩu không bao giờ được in. File dump chứa hash mật khẩu → thư mục 700,
# file 600; nên để ở nơi KHÔNG phải Supabase (xem docs/plans/reports/db-backup-restore-safety-report.md).
# Thoát mã khác 0 nếu dump lỗi hoặc không đọc lại được (để systemd/cron báo thất bại).
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$BACKEND_DIR/.env"
BACKUP_DIR="${BACKUP_DIR:-$HOME/aura-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

# Đọc biến từ .env mà không `source` (URL chứa & sẽ làm shell tách lệnh).
DB_URL="${DATABASE_URL:-$( [[ -f "$ENV_FILE" ]] && grep -E '^DATABASE_URL=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true )}"
[[ -n "$DB_URL" ]] || { echo "Thiếu DATABASE_URL" >&2; exit 2; }
# node-postgres hiểu `uselibpqcompat`, libpq thì không.
PG_URL="$(sed -E 's/([?&])uselibpqcompat=[^&]*&?/\1/; s/[?&]$//' <<<"$DB_URL")"

umask 077
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

stamp="$(date +%F-%H%M)"
dump="$BACKUP_DIR/aura-$stamp.dump"
tmp="$dump.partial"
trap 'rm -f "$tmp"' EXIT

PGCONNECT_TIMEOUT=30 pg_dump "$PG_URL" --no-owner --no-privileges -Fc -f "$tmp" 2>&1 \
  | sed -E 's#postgres(ql)?://[^ ]*#<redacted-url>#g' >&2
[[ -s "$tmp" ]] || { echo "pg_dump không tạo ra file" >&2; exit 1; }

# Đọc lại TOC và bắt buộc có dữ liệu các bảng cốt lõi: dump rỗng/cắt cụt không được coi là backup.
toc="$(pg_restore --list "$tmp")"
for table in users roles rooms exhibits exhibit_revisions audit_logs; do
  grep -qE "TABLE DATA public $table " <<<"$toc" || { echo "Backup thiếu dữ liệu bảng $table" >&2; exit 1; }
done

mv "$tmp" "$dump"
trap - EXIT
(cd "$BACKUP_DIR" && sha256sum "$(basename "$dump")" > "$(basename "$dump").sha256")

# Giữ KEEP_DAYS ngày gần nhất, nhưng luôn giữ ít nhất 3 bản dù cũ.
mapfile -t old < <(ls -1t "$BACKUP_DIR"/aura-*.dump 2>/dev/null | tail -n +4)
for f in "${old[@]}"; do
  [[ -n "$f" && $(find "$f" -mtime +"$KEEP_DAYS" -print) ]] && rm -f "$f" "$f.sha256"
done

echo "OK $(basename "$dump") $(du -h "$dump" | cut -f1), $(grep -vc '^;' <<<"$toc") mục TOC, còn $(ls -1 "$BACKUP_DIR"/aura-*.dump | wc -l) bản"
