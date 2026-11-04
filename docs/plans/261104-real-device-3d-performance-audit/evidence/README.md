# Evidence index / cấu trúc

Chỉ lưu file thực sự thu được. Không tạo JSON/trace/ảnh mẫu giả. `environment-discovery.json` ghi quan sát môi trường hiện tại; các file raw measurement và quality-gate logs chỉ thêm sau khi chạy thành công/thất bại thực tế.

Tên khuyến nghị: `<device>-<scenario>-<orientation>-run<n>.json`, trace cùng prefix. Mỗi artifact cần source commit, production/dev, software/physical và fixture/live. Raw giữ nguyên, summary có thể tái tạo từ raw bằng analysis CLI. Không commit .env, serial, tokens, signed URLs, heap snapshots chứa dữ liệu cá nhân hoặc build output.

Hiện discovery không có điện thoại có thể debug; không có raw mobile. Nội dung plan/protocol không phải measurement evidence.
