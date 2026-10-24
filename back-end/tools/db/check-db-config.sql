-- Kiểm tra an toàn cấu hình PostgreSQL cho Aura Museum. CHỈ ĐỌC catalog/thiết lập,
-- không đọc dữ liệu nghiệp vụ. Chạy qua tools/db/check-db-config.sh (phiên read-only).
-- Biến psql: is_local=true|false (DB cục bộ thì không bắt buộc TLS).
-- Mỗi dòng: check | status (PASS/WARN/FAIL/INFO) | detail.
\set ON_ERROR_STOP on
\pset footer off

-- Khóa phiên ở chế độ chỉ đọc trước mọi truy vấn (không phụ thuộc PGOPTIONS mà pooler có thể bỏ qua).
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;

WITH _app_tables AS (
  SELECT c.oid, c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'migrations'
), checks(ord, check_name, status, detail) AS (
  SELECT 1, 'TLS cho kết nối hiện tại',
    CASE WHEN s.ssl THEN 'PASS' WHEN :'is_local' = 'true' THEN 'INFO' ELSE 'FAIL' END,
    CASE WHEN s.ssl THEN s.version || ' / ' || s.cipher
      WHEN :'is_local' = 'true' THEN 'DB cục bộ, không mã hóa' ELSE 'Kết nối không mã hóa' END
  FROM pg_stat_ssl s WHERE s.pid = pg_backend_pid()

  UNION ALL SELECT 2, 'Phiên bản server',
    CASE WHEN current_setting('server_version_num')::int >= 140000 THEN 'PASS' ELSE 'WARN' END,
    current_setting('server_version')

  UNION ALL SELECT 3, 'password_encryption',
    CASE WHEN current_setting('password_encryption') = 'scram-sha-256' THEN 'PASS' ELSE 'FAIL' END,
    current_setting('password_encryption')

  UNION ALL SELECT 4, 'Role ứng dụng không phải superuser',
    CASE WHEN r.rolsuper THEN 'WARN' ELSE 'PASS' END,
    current_user || CASE WHEN r.rolsuper THEN ' là SUPERUSER' ELSE ' (không superuser)' END
  FROM pg_roles r WHERE r.rolname = current_user

  UNION ALL SELECT 5, 'PUBLIC không có quyền CREATE trên schema public',
    CASE WHEN has_schema_privilege('public', 'public', 'CREATE') THEN 'WARN' ELSE 'PASS' END,
    CASE WHEN has_schema_privilege('public', 'public', 'CREATE')
      THEN 'REVOKE CREATE ON SCHEMA public FROM PUBLIC' ELSE 'Đã thu hồi' END

  UNION ALL SELECT 6, 'Bảng có thể bị đọc qua Data API (anon/authenticated)',
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('anon', 'authenticated')) THEN 'INFO'
      WHEN count(*) FILTER (WHERE exposed AND NOT rls) > 0 THEN 'FAIL'
      ELSE 'PASS'
    END,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('anon', 'authenticated'))
        THEN 'Không có role anon/authenticated (không phải Supabase)'
      ELSE coalesce(nullif(string_agg(relname, ', ' ORDER BY relname) FILTER (WHERE exposed AND NOT rls), ''),
        'Không bảng nào vừa được cấp quyền vừa tắt RLS')
    END
  FROM (
    SELECT t.relname, c.relrowsecurity AS rls,
      EXISTS (
        SELECT 1 FROM pg_roles r
        WHERE r.rolname IN ('anon', 'authenticated')
          AND (has_table_privilege(r.oid, t.oid, 'SELECT') OR has_table_privilege(r.oid, t.oid, 'INSERT')
            OR has_table_privilege(r.oid, t.oid, 'UPDATE') OR has_table_privilege(r.oid, t.oid, 'DELETE'))
      ) AS exposed
    FROM _app_tables t JOIN pg_class c ON c.oid = t.oid
  ) exposure

  UNION ALL SELECT 7, 'Bảng ứng dụng bật RLS',
    CASE WHEN count(*) FILTER (WHERE NOT c.relrowsecurity) = 0 THEN 'PASS' ELSE 'INFO' END,
    count(*) FILTER (WHERE c.relrowsecurity) || '/' || count(*) || ' bảng bật RLS'
  FROM _app_tables t JOIN pg_class c ON c.oid = t.oid

  UNION ALL SELECT 8, 'statement_timeout của phiên',
    CASE WHEN current_setting('statement_timeout') IN ('0', '0ms') THEN 'WARN' ELSE 'PASS' END,
    current_setting('statement_timeout')

  UNION ALL SELECT 9, 'idle_in_transaction_session_timeout',
    CASE WHEN current_setting('idle_in_transaction_session_timeout') IN ('0', '0ms') THEN 'WARN' ELSE 'PASS' END,
    current_setting('idle_in_transaction_session_timeout')

  UNION ALL SELECT 10, 'Kết nối đang dùng / max_connections',
    CASE WHEN count(*) > 0.8 * current_setting('max_connections')::int THEN 'WARN' ELSE 'PASS' END,
    count(*) || '/' || current_setting('max_connections')
  FROM pg_stat_activity

  UNION ALL SELECT 11, 'Extension bắt buộc (uuid-ossp, citext)',
    CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END,
    coalesce(string_agg(extname || ' ' || extversion, ', ' ORDER BY extname), 'thiếu')
  FROM pg_extension WHERE extname IN ('uuid-ossp', 'citext')

  UNION ALL SELECT 12, 'Migration đã chạy',
    CASE WHEN count(*) > 0 THEN 'INFO' ELSE 'FAIL' END,
    count(*) || ' migration, mới nhất: ' || coalesce(max(name), '-')
  FROM migrations

  UNION ALL SELECT 13, 'Ràng buộc CHECK/FK đều VALID',
    CASE WHEN count(*) FILTER (WHERE NOT convalidated) = 0 THEN 'PASS' ELSE 'FAIL' END,
    count(*) || ' ràng buộc, ' || count(*) FILTER (WHERE NOT convalidated) || ' NOT VALID'
  FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype IN ('c', 'f')

  UNION ALL SELECT 14, 'Index đều hợp lệ',
    CASE WHEN count(*) FILTER (WHERE NOT i.indisvalid) = 0 THEN 'PASS' ELSE 'FAIL' END,
    count(*) || ' index, ' || count(*) FILTER (WHERE NOT i.indisvalid) || ' invalid'
  FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid
  WHERE c.relnamespace = 'public'::regnamespace

  UNION ALL SELECT 15, 'Mọi bảng ứng dụng có khóa chính',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    coalesce(string_agg(relname, ', '), 'Đủ')
  FROM _app_tables t
  WHERE NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = t.oid AND contype = 'p')

  UNION ALL SELECT 16, 'Không có mật khẩu dạng plaintext/md5 trong users.password_hash',
    CASE WHEN count(*) FILTER (WHERE password_hash !~ '^\$2[aby]\$\d{2}\$') = 0 THEN 'PASS' ELSE 'FAIL' END,
    count(*) || ' tài khoản, ' || count(*) FILTER (WHERE password_hash !~ '^\$2[aby]\$\d{2}\$') || ' không phải bcrypt'
  FROM users

  UNION ALL SELECT 17, 'Refresh token lưu dạng SHA-256 (64 hex)',
    CASE WHEN count(*) FILTER (WHERE token_hash !~ '^[0-9a-f]{64}$') = 0 THEN 'PASS' ELSE 'FAIL' END,
    count(*) || ' session, ' || count(*) FILTER (WHERE token_hash !~ '^[0-9a-f]{64}$') || ' sai định dạng'
  FROM refresh_sessions

  UNION ALL SELECT 18, 'wal_level / archive_mode (PITR)', 'INFO',
    'wal_level=' || current_setting('wal_level') || ', archive_mode=' || current_setting('archive_mode')

  UNION ALL SELECT 19, 'Dung lượng database', 'INFO',
    pg_size_pretty(pg_database_size(current_database()))

  UNION ALL SELECT 20, 'Phiên kiểm tra ở chế độ chỉ đọc',
    CASE WHEN current_setting('transaction_read_only') = 'on' THEN 'PASS' ELSE 'FAIL' END,
    'transaction_read_only=' || current_setting('transaction_read_only')
)
SELECT check_name AS "check", status, detail FROM checks ORDER BY ord;
