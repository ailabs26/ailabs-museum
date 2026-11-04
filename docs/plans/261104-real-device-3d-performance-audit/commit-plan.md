# Atomic commits

1. `docs(perf): plan real-device 3D performance audit` — kế hoạch, protocol, device discovery và giới hạn baseline trước source.
2. `test(perf): add opt-in production scene audit` — metrics/schema, bounded collector, observer/UI và test liên quan cùng commit.
3. `test(perf): add reproducible audit analysis and benchmark` — CLI tái phân tích, automation và regression bổ sung nếu độc lập.
4. `docs(perf): deliver audit evidence and device handoff` — raw measurements thực, quality gates, report tiếng Việt và hướng dẫn tiếp tục.

Chỉ stage đường dẫn cụ thể sau review diff và chạy checks liên quan. Không tạo commit trống, không tách test khỏi logic. SHA thực tế xem `git log 3ccdd73..HEAD` và thông báo bàn giao (tránh tự tham chiếu SHA commit tài liệu cuối). Không push, PR hoặc merge theo yêu cầu.
