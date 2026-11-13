-- Vân tay dữ liệu + schema để so sánh DB nguồn và DB khôi phục (chỉ đọc).
-- Mỗi bảng public: số dòng + md5 của toàn bộ dòng (sắp xếp theo text). Dòng ghi bởi
-- chính drill (audit_logs.action 'drill.concurrent' / 'drill.post-backup') bị loại để so
-- đúng snapshot trước backup; các dòng đó được kiểm riêng trong backup-restore-drill.sh.
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;

SELECT string_agg(
  format(
    'SELECT %L AS item, count(*)::text AS n, md5(coalesce(string_agg(x::text, %L ORDER BY x::text), %L)) AS h FROM %I x%s',
    c.relname, '|', '', c.relname,
    CASE WHEN c.relname = 'audit_logs' THEN ' WHERE x.action NOT IN (''drill.concurrent'', ''drill.post-backup'')' ELSE '' END
  ),
  ' UNION ALL ' ORDER BY c.relname
) || ' ORDER BY 1'
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
\gexec

-- CHECK dạng `x IN (...)` được PostgreSQL in lại khác văn bản sau dump/restore
-- (`(ARRAY['a'::varchar])::text[]` → `ARRAY[('a'::varchar)::text]`) dù tương đương ngữ nghĩa,
-- nên bỏ cast/ngoặc/khoảng trắng trước khi băm.
SELECT 'schema:constraints', count(*)::text, md5(string_agg(
  conrelid::regclass || ' ' || conname || ' ' || contype::text || ' ' || convalidated::text || ' '
    || regexp_replace(pg_get_constraintdef(oid), '::[a-z ]+(\[\])?|[()[:space:]]', '', 'g'),
  '|' ORDER BY conrelid::regclass::text, conname))
FROM pg_constraint WHERE connamespace = 'public'::regnamespace;

SELECT 'schema:indexes', count(*)::text, md5(string_agg(indexdef, '|' ORDER BY indexname))
FROM pg_indexes WHERE schemaname = 'public';

SELECT 'schema:columns', count(*)::text, md5(string_agg(table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable || ' ' || coalesce(column_default, ''), '|' ORDER BY table_name, ordinal_position))
FROM information_schema.columns WHERE table_schema = 'public';

SELECT 'schema:extensions', count(*)::text, string_agg(extname || '@' || extversion, ',' ORDER BY extname)
FROM pg_extension;
