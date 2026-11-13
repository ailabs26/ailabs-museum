# Atomic commits

1. `docs(perf): plan real-device 3D performance audit` — kế hoạch, protocol, device discovery và giới hạn baseline trước source.
2. `test(perf): add opt-in production scene audit` — metrics/schema, bounded collector, observer/UI và test liên quan cùng commit.
3. `test(perf): add reproducible audit analysis and benchmark` — CLI tái phân tích, automation và regression bổ sung nếu độc lập.
4. `fix(perf): reject mixed workloads and validate benchmark repeats` — xử lý review độc lập bằng regression RED→GREEN, tuyến input theo elapsed time, camera checkpoints và test lifecycle scope đúng renderer.
5. `fix(perf): keep collapsed audit clear of scene controls` — sửa riêng panel audit sau reproduction pointer interception; thêm browser regression và bounded action timeout.
6. `test(perf): respect native TypeScript analysis runtime` — guard CLI rõ ràng và skip optional smoke khi runtime app cũ không có native TS; RED→GREEN với flag tắt stripping.
7. `docs(perf): deliver audit evidence and device handoff` — raw measurements thực, quality gates, report tiếng Việt và hướng dẫn tiếp tục.

Chỉ stage đường dẫn cụ thể sau review diff và chạy checks liên quan. Không tạo commit trống, không tách test khỏi logic. SHA thực tế xem `git log 3ccdd73..HEAD` và thông báo bàn giao (tránh tự tham chiếu SHA commit tài liệu cuối). Không push, PR hoặc merge theo yêu cầu.

## Commits thực thi

| SHA | Trách nhiệm |
| --- | --- |
| `f5f71f6` | Plan, protocol và environment discovery trước source |
| `a41878e` | Production opt-in observer/panel, raw schema, metric/collector/lifecycle tests |
| `7971b44` | CLI tái phân tích và benchmark opt-in hardware; mặc định CI software giữ nguyên |
| `2bb7833` | Sửa ba Important từ review, camera checkpoint/tuyến tái lập và scoped lifecycle regression |
| `d4e1d56` | Thu gọn audit thành nút44px ngoài toolbar, regression reset sau collapse và action timeout15s |
| `03a2990` | Giữ app/CI runtime cũ tương thích, CLI native-TS guard và kiểm tra error khi tắt stripping |

Commit tài liệu/evidence cuối được cung cấp trong bàn giao. Source build đo thực tế là `d4e1d5647a271cdae808ece9e8210ef6fcad2cef`; sau đó chỉ đổi guard/test CLI và tài liệu/evidence, không đổi app bundle. Warm-up source `2bb7833` bị dừng ở nút reset, không tạo raw primary30s và không được dùng nghiệm thu.
