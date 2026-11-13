-- Dữ liệu tổng hợp cho diễn tập backup/restore (CHỈ chạy trên DB tạm của drill).
-- Biến psql: scale (số phòng). Mỗi phòng: 50 hiện vật × 3 revision × 2 hotspot,
-- 1 báo cáo / 5 hiện vật, 5.000 audit log. Có tiếng Việt + JSONB để kiểm mã hóa ký tự.
\set ON_ERROR_STOP on

INSERT INTO users (email, password_hash, display_name)
SELECT format('drill-user-%s@aura.local', g),
       '$2a$12$' || substr(md5(g::text) || md5((g + 1)::text), 1, 53),
       format('Biên tập viên %s', g)
FROM generate_series(1, 20) g;

INSERT INTO rooms (slug, name, description)
SELECT format('phong-%s', g), format('Phòng trưng bày số %s', g), 'Không gian gốm sứ Việt Nam thế kỷ XV–XVIII'
FROM generate_series(1, :scale) g;

INSERT INTO exhibits (room_id, visibility, display_order, version)
SELECT r.id, CASE WHEN g % 4 = 0 THEN 'hidden' ELSE 'visible' END, g, g % 7
FROM rooms r CROSS JOIN generate_series(1, 50) g;

INSERT INTO exhibit_revisions (exhibit_id, revision_no, state, content, created_by)
SELECT e.id, n,
       CASE n WHEN 1 THEN 'approved' WHEN 2 THEN 'rejected' ELSE 'draft' END,
       jsonb_build_object(
         'name', 'Bình gốm men lam ' || left(e.id::text, 8),
         'description', repeat('Hoa văn rồng mây, men trắng xanh, niên đại thời Lê sơ. ', 15),
         'position', jsonb_build_object('x', random() * 10, 'y', 0, 'z', random() * 10),
         'tags', jsonb_build_array('gốm', 'men lam', 'thế kỷ XV')
       ),
       (SELECT id FROM users ORDER BY email LIMIT 1)
FROM exhibits e CROSS JOIN generate_series(1, 3) n;

UPDATE exhibits e SET published_revision_id = r.id
FROM exhibit_revisions r
WHERE r.exhibit_id = e.id AND r.revision_no = 1 AND e.visibility = 'visible';

INSERT INTO hotspots (revision_id, label, body, position_x, position_y, position_z, display_order)
SELECT r.id, 'Chi tiết ' || h, 'Vết rạn men đặc trưng lò Chu Đậu', random(), random(), random(), h
FROM exhibit_revisions r CROSS JOIN generate_series(1, 2) h;

INSERT INTO content_reports (exhibit_id, reported_revision_id, category, message, status)
SELECT e.id, e.published_revision_id, 'wrong_info', 'Niên đại ghi sai, đề nghị kiểm tra lại',
       (ARRAY['open', 'in_progress', 'resolved', 'dismissed'])[1 + (row_number() OVER () % 4)]
FROM exhibits e
WHERE e.display_order % 5 = 0;

INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, reason, request_id, occurred_at)
SELECT (SELECT id FROM users ORDER BY email LIMIT 1),
       (ARRAY['exhibit.update', 'revision.publish', 'room.update', 'access.denied'])[1 + g % 4],
       'exhibit', gen_random_uuid(), CASE WHEN g % 10 = 0 THEN 'Cập nhật mô tả' END,
       'req-' || g, now() - (g || ' seconds')::interval
FROM generate_series(1, 5000 * :scale) g;

ANALYZE;
