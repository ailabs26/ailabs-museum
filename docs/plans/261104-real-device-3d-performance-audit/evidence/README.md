# Evidence index / cấu trúc

Chỉ lưu file thực sự thu được. Không tạo JSON/trace/ảnh mẫu giả. `environment-discovery.json` ghi quan sát môi trường hiện tại; các file raw measurement và quality-gate logs chỉ thêm sau khi chạy thành công/thất bại thực tế.

Tên khuyến nghị: `<device>-<scenario>-<orientation>-run<n>.json`, trace cùng prefix. Mỗi artifact cần source commit, production/dev, software/physical và fixture/live. Raw giữ nguyên, summary có thể tái tạo từ raw bằng analysis CLI. Không commit .env, serial, tokens, signed URLs, heap snapshots chứa dữ liệu cá nhân hoặc build output.

Hiện discovery không có điện thoại có thể debug; không có raw mobile. Nội dung plan/protocol không phải measurement evidence.

## Dữ liệu đã thu

- `desktop/desktop-environment.json`: actual browser/hardware string, build d4e1d56, viewport/conditions. Host đối chiếu CIM trong `environment-discovery.json`.
- `desktop/desktop-P03-run1.json` đến `run3.json`: three production hardware continuous captures,5 minh họa/0GLB; schema v1. `desktop-P07-10min.json`:601.269s/54030 frames. `desktop-idle.json`:30.012s/0 frames.
- `desktop/analysis.json`: tái tạo bằng CLI, per-run metrics và grouping/variance. Idle không eligible cho **continuous** là đúng, không phải idle FAIL.
- `desktop/desktop-lifecycle.json`:10 mounts,50 selections,10 switches; forced-GC JS heap và observed target/texture/buffer inventory. GPU bytes không đo trực tiếp.
- `desktop/derived-trends.json`:60s windows dùng cùng metric helper, camera replay comparability và trace event counts. `desktop/estimated-footprint.json`: công thức texel/buffer-equivalent có assumptions/exclusions, không phải total GPU allocation.
- `desktop/desktop-P03-profiler-trace.json.gz`: trace riêng khoảng10s, không trộn vào primary FPS. Giải nén gzip thành JSON nếu DevTools Performance import không nhận gzip. `desktop/desktop-fixture.png`: ảnh thực đã xem, không chứa GLB live.
- `desktop/aborted-at-reset-environment.json`: warm-up build2bb7833 trước sửa panel; **không có primary FPS run**, không dùng nghiệm thu.
- `quality-gates.json` và `logs/`: commands/outcomes thực, cả initial failures, RED proofs và rechecks. Không cộng lượt trùng thành unique tests.

## Tái phân tích

Từ `front-end/`, Node22.18+/24+ có native TypeScript:

```powershell
$auditRaw='../docs/plans/261104-real-device-3d-performance-audit/evidence/desktop'
node scripts/analyze-museum-audit.mjs "$auditRaw/desktop-P03-run1.json" "$auditRaw/desktop-P03-run2.json" "$auditRaw/desktop-P03-run3.json" "$auditRaw/desktop-P07-10min.json" "$auditRaw/desktop-idle.json" > "$auditRaw/analysis.json"
```

Không truyền environment/inventory/summary vào schema raw-run. CLI báo lỗi rõ nếu runtime thiếu native TS; optional CLI smoke được skip trên runtime đó để không thay floor của app, các metric tests vẫn chạy qua Vitest. Máy audit Node24 chạy244/244 unit không skip.

`manifest.json` chứa SHA256/size cho artifacts đã lưu (không tự hash chính nó). `.gitattributes` giữ nguyên bytes JSON/log để checksum không đổi do CRLF checkout. Manifest hỗ trợ kiểm tra tính toàn vẹn, không thay thế xác nhận provenance thiết bị.
