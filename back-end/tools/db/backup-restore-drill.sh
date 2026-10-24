#!/usr/bin/env bash
# Diễn tập sự cố MẤT TOÀN BỘ DB và khôi phục từ bản backup logic (pg_dump -Fc), đo RPO/RTO.
# Chỉ dùng container Docker tạm — KHÔNG kết nối DB dùng chung/Supabase.
#
#   tools/db/backup-restore-drill.sh                  # SCALE=20 phòng (~1.000 hiện vật, 100k audit log)
#   SCALE=50 OUT_DIR=/tmp/drill tools/db/backup-restore-drill.sh
#   KEEP=1 tools/db/backup-restore-drill.sh            # giữ container khôi phục để soi
#
# Kịch bản:
#   1. Dựng DB nguồn: migration + seed RBAC + dữ liệu tổng hợp (drill-seed.sql), ghi marker trước backup.
#   2. Backup nóng: pg_dump -Fc trong khi một tiến trình vẫn ghi đồng thời (kiểm snapshot nhất quán).
#   3. Ghi marker SAU backup (mô phỏng dữ liệu phát sinh giữa lần backup cuối và sự cố).
#   4. Sự cố: xóa hẳn container nguồn (mất server + dữ liệu).
#   5. Khôi phục: dựng server mới → kiểm checksum file → pg_restore --exit-on-error → ANALYZE.
#   6. Xác minh: vân tay từng bảng + schema khớp nguồn, marker trước có / sau mất, ghi đồng thời
#      không có "lỗ", migration đầy đủ, integration test lõi chạy được trên DB khôi phục.
# RTO đo = thời điểm sự cố → xác minh xong. Thoát mã khác 0 nếu bất kỳ bước xác minh nào hỏng.
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
TOOLS_DIR="$BACKEND_DIR/tools/db"
SCALE="${SCALE:-20}"
PG_IMAGE="${PG_IMAGE:-postgres:16-alpine}"
OUT_DIR="${OUT_DIR:-$(mktemp -d -t aura-drill-XXXXXX)}"
KEEP="${KEEP:-0}"
SRC="aura-drill-src-$$"
DST="aura-drill-dst-$$"
DB=aura
mkdir -p "$OUT_DIR"

now() { date +%s.%N; }
elapsed() { awk -v a="$1" -v b="$2" 'BEGIN { printf "%.2f", b - a }'; }
log() { printf '[%s] %s\n' "$(date +%T)" "$*"; }
fail() { log "THẤT BẠI: $*"; exit 1; }

cleanup() {
  [[ -n "${WRITER_PID:-}" ]] && kill "$WRITER_PID" 2>/dev/null || true
  docker rm -f "$SRC" >/dev/null 2>&1 || true
  [[ "$KEEP" == 1 ]] || docker rm -f "$DST" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Dựng 1 server Postgres tạm, chờ nhận kết nối TCP (bỏ qua server tạm của bước init), in URL.
start_server() {
  docker run -d --rm --name "$1" -e POSTGRES_PASSWORD=drill -e POSTGRES_DB="$DB" \
    -p 127.0.0.1::5432 "$PG_IMAGE" >/dev/null
  for _ in $(seq 1 60); do
    docker exec "$1" psql -h 127.0.0.1 -U postgres -d "$DB" -qAtc 'select 1' >/dev/null 2>&1 && break
    sleep 0.5
  done
  docker exec "$1" psql -h 127.0.0.1 -U postgres -d "$DB" -qAtc 'select 1' >/dev/null
  echo "postgres://postgres:drill@127.0.0.1:$(docker port "$1" 5432/tcp | head -n1 | cut -d: -f2)/$DB"
}

psql_in() { local c="$1"; shift; docker exec -i "$c" psql -h 127.0.0.1 -U postgres -d "$DB" -X -q -v ON_ERROR_STOP=1 "$@"; }

# ---------------------------------------------------------------- 1. DB nguồn
log "Dựng DB nguồn ($PG_IMAGE, SCALE=$SCALE)"
SRC_URL="$(start_server "$SRC")"
(
  cd "$BACKEND_DIR"
  export DATABASE_URL="$SRC_URL" DATABASE_SSL=false MEDIA_STORAGE_DRIVER=local
  npm run -s migration:run >/dev/null
  SEED_ADMIN_EMAIL=drill-admin@aura.local SEED_ADMIN_PASSWORD="Drill-$(openssl rand -hex 8)" npm run -s seed >/dev/null
)
psql_in "$SRC" -v scale="$SCALE" < "$TOOLS_DIR/drill-seed.sql"
psql_in "$SRC" -c "INSERT INTO audit_logs (action, resource_type, resource_id, request_id)
  VALUES ('drill.pre-backup', 'drill', gen_random_uuid(), 'marker-pre')"
psql_in "$SRC" < "$TOOLS_DIR/drill-fingerprint.sql" > "$OUT_DIR/source.fingerprint"
SRC_SIZE="$(psql_in "$SRC" -At -c "select pg_size_pretty(pg_database_size('$DB'))")"
SRC_ROWS="$(awk -F'|' '$1 !~ /^schema:/ { s += $2 } END { print s }' "$OUT_DIR/source.fingerprint")"
log "DB nguồn: $SRC_SIZE, $SRC_ROWS dòng"

# ---------------------------------------------------------------- 2. Backup nóng
log "Backup (pg_dump -Fc) trong khi có ghi đồng thời"
# Vòng ghi chạy TRONG container; dừng bằng file cờ vì kill tiến trình `docker exec` phía host
# không dừng được tiến trình bên trong.
docker exec "$SRC" sh -c 'i=0; while [ ! -f /tmp/stop-writer ]; do i=$((i+1));
  psql -h 127.0.0.1 -U postgres -d aura -qAtc "INSERT INTO audit_logs (action, resource_type, resource_id, request_id)
    VALUES ('"'"'drill.concurrent'"'"', '"'"'drill'"'"', gen_random_uuid(), '"'"'conc-'"'"' || $i)" >/dev/null 2>&1 || exit 0;
  done' &
WRITER_PID=$!
sleep 1
T_BACKUP_START="$(now)"
docker exec "$SRC" pg_dump -h 127.0.0.1 -U postgres -d "$DB" -Fc -Z 6 -f /tmp/aura.dump
T_BACKUP_END="$(now)"
sleep 1
docker exec "$SRC" touch /tmp/stop-writer
wait "$WRITER_PID" 2>/dev/null || true
WRITER_PID=
CONC_SOURCE="$(psql_in "$SRC" -At -c "select count(*) from audit_logs where action = 'drill.concurrent'")"
docker cp "$SRC:/tmp/aura.dump" "$OUT_DIR/aura.dump" >/dev/null
DUMP_SHA="$(sha256sum "$OUT_DIR/aura.dump" | cut -d' ' -f1)"
DUMP_SIZE="$(du -h "$OUT_DIR/aura.dump" | cut -f1)"
DUMP_TOC="$(docker exec "$SRC" pg_restore --list /tmp/aura.dump | grep -vc '^;')"
log "Backup xong: $DUMP_SIZE, $DUMP_TOC mục TOC, $(elapsed "$T_BACKUP_START" "$T_BACKUP_END")s"

# ---------------------------------------------------------------- 3-4. Ghi sau backup + sự cố
psql_in "$SRC" -c "INSERT INTO audit_logs (action, resource_type, resource_id, request_id)
  VALUES ('drill.post-backup', 'drill', gen_random_uuid(), 'marker-post')"
T_DISASTER="$(now)"
docker rm -f "$SRC" >/dev/null
log "SỰ CỐ: đã xóa hẳn server nguồn"

# ---------------------------------------------------------------- 5. Khôi phục
DST_URL="$(start_server "$DST")"
T_PROVISIONED="$(now)"
docker cp "$OUT_DIR/aura.dump" "$DST:/tmp/aura.dump" >/dev/null
[[ "$(docker exec "$DST" sha256sum /tmp/aura.dump | cut -d' ' -f1)" == "$DUMP_SHA" ]] || fail "checksum bản backup không khớp"
T_TRANSFERRED="$(now)"
docker exec "$DST" pg_restore -h 127.0.0.1 -U postgres -d "$DB" --exit-on-error --no-owner -j 4 /tmp/aura.dump
T_RESTORED="$(now)"
psql_in "$DST" -c 'ANALYZE'
T_ANALYZED="$(now)"
log "Khôi phục xong sau $(elapsed "$T_DISASTER" "$T_ANALYZED")s kể từ sự cố"

# ---------------------------------------------------------------- 6. Xác minh
psql_in "$DST" < "$TOOLS_DIR/drill-fingerprint.sql" > "$OUT_DIR/restored.fingerprint"
diff -u "$OUT_DIR/source.fingerprint" "$OUT_DIR/restored.fingerprint" > "$OUT_DIR/fingerprint.diff" \
  || fail "vân tay dữ liệu/schema khác nguồn (xem $OUT_DIR/fingerprint.diff)"
[[ "$(psql_in "$DST" -At -c "select count(*) from audit_logs where request_id = 'marker-pre'")" == 1 ]] \
  || fail "mất marker ghi TRƯỚC backup"
POST_MARKER="$(psql_in "$DST" -At -c "select count(*) from audit_logs where request_id = 'marker-post'")"
[[ "$POST_MARKER" == 0 ]] || fail "marker ghi SAU backup lại xuất hiện — bản backup không phải snapshot"
read -r CONC_RESTORED CONC_MAX < <(psql_in "$DST" -At -F' ' -c "select count(*), coalesce(max(substr(request_id, 6)::int), 0)
  from audit_logs where action = 'drill.concurrent'")
[[ "$CONC_RESTORED" == "$CONC_MAX" ]] || fail "ghi đồng thời bị thủng ($CONC_RESTORED dòng, seq tối đa $CONC_MAX)"
(
  cd "$BACKEND_DIR"
  export DATABASE_URL="$DST_URL" DATABASE_SSL=false
  npx typeorm-ts-node-commonjs migration:show -d src/config/data-source.ts > "$OUT_DIR/migrations.txt"
  ! grep -q '\[ \]' "$OUT_DIR/migrations.txt" || { echo "Còn migration chưa chạy" >&2; exit 1; }
  CORE_TEST_DATABASE_URL="$DST_URL" node -r reflect-metadata -r ts-node/register --test \
    src/common/tests/core-db.integration.spec.ts > "$OUT_DIR/core-db-on-restored.txt" 2>&1
) || fail "ứng dụng không chạy đúng trên DB khôi phục (xem $OUT_DIR)"
T_VERIFIED="$(now)"
MIGRATIONS="$(grep -c '\[X\]' "$OUT_DIR/migrations.txt")"
CORE_PASS="$(grep -oE '^ℹ pass [0-9]+' "$OUT_DIR/core-db-on-restored.txt" | awk '{print $3}')"

# ---------------------------------------------------------------- Báo cáo
PG_VERSION="$(docker exec "$DST" postgres --version)"
cat > "$OUT_DIR/drill-summary.md" <<EOF
# Kết quả diễn tập backup/restore — $(date '+%F %T %Z')

| Hạng mục | Giá trị |
|---|---|
| Server | $PG_VERSION (Docker \`$PG_IMAGE\`) |
| Dữ liệu nguồn | $SRC_SIZE, $SRC_ROWS dòng (SCALE=$SCALE) |
| Bản backup | pg_dump -Fc -Z 6, $DUMP_SIZE, $DUMP_TOC mục TOC, sha256 \`${DUMP_SHA:0:16}…\` |
| Thời gian backup | $(elapsed "$T_BACKUP_START" "$T_BACKUP_END") s (có ghi đồng thời) |
| Ghi đồng thời trong lúc backup | $CONC_SOURCE dòng ở nguồn, $CONC_RESTORED dòng có trong bản backup, không thủng chuỗi |
| Cửa sổ mất dữ liệu đo được (RPO thực tế) | $(elapsed "$T_BACKUP_START" "$T_DISASTER") s (bắt đầu backup → sự cố); marker sau backup: mất như dự kiến |

| Giai đoạn RTO | Thời gian (s) |
|---|---|
| Dựng server mới | $(elapsed "$T_DISASTER" "$T_PROVISIONED") |
| Chuyển file + kiểm checksum | $(elapsed "$T_PROVISIONED" "$T_TRANSFERRED") |
| pg_restore (-j 4, --exit-on-error) | $(elapsed "$T_TRANSFERRED" "$T_RESTORED") |
| ANALYZE | $(elapsed "$T_RESTORED" "$T_ANALYZED") |
| Xác minh (vân tay, marker, migration, integration test) | $(elapsed "$T_ANALYZED" "$T_VERIFIED") |
| **Tổng RTO (sự cố → xác minh xong)** | **$(elapsed "$T_DISASTER" "$T_VERIFIED")** |

Xác minh: vân tay $(grep -vc '^schema:' "$OUT_DIR/source.fingerprint") bảng + 4 nhóm schema khớp tuyệt đối;
$MIGRATIONS migration [X]; integration test lõi trên DB khôi phục: ${CORE_PASS:-?} pass.
EOF
cat "$OUT_DIR/drill-summary.md"
log "Chi tiết: $OUT_DIR"
