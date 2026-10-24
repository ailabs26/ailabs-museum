#!/usr/bin/env bash
# Kiểm tra an toàn cấu hình DB (chỉ đọc) + cấu hình kết nối phía ứng dụng.
#
#   tools/db/check-db-config.sh                 # dùng DATABASE_URL trong back-end/.env
#   DATABASE_URL=postgres://... tools/db/check-db-config.sh
#
# Phiên psql bị khóa READ ONLY ngay câu lệnh đầu (xem .sql) nên không thể ghi. URL/mật khẩu
# không bao giờ được in ra. Thoát mã 1 nếu có check FAIL.
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$BACKEND_DIR/.env"

# Đọc 1 biến từ .env mà không `source` (URL chứa & sẽ làm shell tách lệnh).
env_value() {
  [[ -f "$ENV_FILE" ]] || return 0
  grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- || true
}

DB_URL="${DATABASE_URL:-$(env_value DATABASE_URL)}"
DB_SSL="${DATABASE_SSL:-$(env_value DATABASE_SSL)}"
DB_SSL_CA="${DATABASE_SSL_CA:-$(env_value DATABASE_SSL_CA)}"
[[ -n "$DB_URL" ]] || { echo "Thiếu DATABASE_URL" >&2; exit 2; }

# node-postgres hiểu `uselibpqcompat`, libpq/psql thì không — bỏ đi trước khi gọi psql.
PSQL_URL="$(sed -E 's/([?&])uselibpqcompat=[^&]*&?/\1/; s/[?&]$//' <<<"$DB_URL")"

echo "== Cấu hình kết nối phía ứng dụng (back-end/.env + data-source.ts)"
app_fail=0
report() { printf '%-4s  %s — %s\n' "$2" "$1" "$3"; [[ "$2" == FAIL ]] && app_fail=1 || true; }

if grep -q "synchronize: false" "$BACKEND_DIR/src/config/data-source.ts"; then
  report "TypeORM synchronize tắt" PASS "data-source.ts"
else
  report "TypeORM synchronize tắt" FAIL "data-source.ts không đặt synchronize: false"
fi

if git -C "$BACKEND_DIR" check-ignore -q .env && ! git -C "$BACKEND_DIR" ls-files --error-unmatch .env >/dev/null 2>&1; then
  report ".env bị git bỏ qua và không được track" PASS ".gitignore"
else
  report ".env bị git bỏ qua và không được track" FAIL ".env có thể bị commit"
fi

sslmode="$(grep -oE 'sslmode=[a-z-]+' <<<"$DB_URL" | cut -d= -f2 || true)"
if [[ "$sslmode" == verify-full || ( "$DB_SSL" == true && -n "$DB_SSL_CA" ) ]]; then
  report "TLS xác thực chứng chỉ server" PASS "${sslmode:-DATABASE_SSL_CA}"
elif [[ "$sslmode" =~ ^(require|verify-ca)$ || "$DB_SSL" == true ]]; then
  report "TLS xác thực chứng chỉ server" WARN "Mã hóa nhưng không xác thực CA (sslmode=${sslmode:-DATABASE_SSL=true}, không CA)"
elif [[ "$PSQL_URL" =~ @(localhost|127\.0\.0\.1)[:/] ]]; then
  report "TLS xác thực chứng chỉ server" INFO "DB cục bộ, không dùng TLS"
else
  report "TLS xác thực chứng chỉ server" FAIL "DB từ xa nhưng không bật TLS"
fi

if [[ "$PSQL_URL" =~ pooler\.supabase\.com:6543 ]]; then
  report "Supabase pooler ở chế độ session (5432)" WARN "Cổng 6543 = transaction mode, không hợp advisory lock/transaction dài"
elif [[ "$PSQL_URL" =~ pooler\.supabase\.com:5432 ]]; then
  report "Supabase pooler ở chế độ session (5432)" PASS "session pooler"
fi

echo
echo "== Cấu hình server (phiên read-only)"
is_local=false
[[ "$PSQL_URL" =~ @(localhost|127\.0\.0\.1)[:/] ]] && is_local=true
server_report="$(PGCONNECT_TIMEOUT=15 psql "$PSQL_URL" -X -q -v is_local="$is_local" -f "$(dirname "$0")/check-db-config.sql")"
echo "$server_report"
grep -qE '\| FAIL +\|' <<<"$server_report" && db_fail=1 || db_fail=0

exit $(( app_fail || db_fail ))
