# Performance Audit Report — Aura Museum

Ngày audit: 2026-11-04. Báo cáo đang được cập nhật bằng kết quả thực thi; nội dung chưa đo được đánh dấu rõ.

## 1. Executive Summary

Phạm vi là audit render submissions, frame pacing, renderer resources và lifecycle, không tối ưu engine. Chưa nghiệm thu desktop60/mobile30: discovery chưa có điện thoại truy cập được; baseline cũ là SwiftShader. Kế hoạch và protocol đã được lập trước sửa source.

## 2. Build & Environment

Base `3ccdd731b0f04139963fbf68ecb04e5f36eaab77`, branch `chore/3d-performance-audit`. Môi trường đọc được trong [environment-discovery.json](evidence/environment-discovery.json). Browser launch mặc định trong quyền hạn hiện tại bị đóng khi khởi tạo; cần thử lại cách chạy được phép trước khi kết luận renderer.

## 3. Methodology

Theo [measurement-protocol.md](measurement-protocol.md): production preview, warmup10s, continuous30–60s x3, cold/idle/lifecycle riêng; không dùng rAF độc lập làm FPS3D. Phân biệt submission CPU time, GPU time và presented frames. Không nới FPS gate trong CI/software rendering.

## 4. Device Matrix

Xem [device-matrix.md](device-matrix.md). Ba Android vật lý và iOS: NOT MEASURED; thiếu thiết bị có thể remote debug. Desktop có phần cứng nhưng chưa xác nhận browser hardware renderer.

## 5. Benchmark Results

| Device | Scenario | Run count | Median FPS | P5 FPS | P95 Frametime | GPU Memory | Evidence | Status |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| Desktop GPU | P01–P10 | 0 | N/A | N/A | N/A | unavailable | discovery | NOT MEASURED — browser chưa xác nhận |
| Android thấp/trung/cao | P01–P10 | 0 | N/A | N/A | N/A | unavailable | discovery | BLOCKED — PHYSICAL DEVICE REQUIRED |
| iPhone/Safari | P01–P10 | 0 | N/A | N/A | N/A | unavailable | discovery | NOT MEASURED — thiếu iPhone/macOS inspector |

## 6. GPU/Memory Analysis

Counts của renderer là measured counters, không GPU bytes. GPU memory/time chính xác hiện unavailable. Tám texture512² RGBA8 đầy mip chain có tổng lý thuyết ~10.67MiB, **estimated**, chưa gồm PMREM, shadow, framebuffer, labels hoặc GLB; không phải tổng allocation đo được. JS heap là miền khác. Cleanup đã có owner nhưng chưa kết luận loại trừ leak trên mọi thiết bị.

## 7. Bottleneck Analysis

Chưa có trace/counterfactual trên GPU thật để kết luận CPU-bound/GPU-bound. Static cost candidates: preserveDrawingBuffer + antialias, PMREM lúc khởi tạo, shadow balanced, material/texture GLB, collision/raycast. Đây là giả thuyết cần trace và phép so sánh kiểm soát, không phải nguyên nhân đã chứng minh. Quality tier dùng hints/viewport, không xếp hạng SoC; điện thoại cao vẫn có thể low khi coarse + cạnh ngắn<=900, Safari thiếu memory hint vẫn chịu viewport rule.

## 8. Risk & Recommendations

- P0 nghiệm thu: cần ba Android thật và desktop browser hardware-rendered; chưa có số liệu không thể PASS.
- P1 đo: trace P01/P03/P05/P07 cùng workload trước quyết định giảm draw/texture/shadow hoặc đổi policy quality. Lợi ích tối ưu hiện chưa xác định.
- P2 coverage: iOS/WebXR headset, A/B overhead, retained heap sau nhiều phiên.

## 9. Regression & Quality Gates

Sẽ ghi kết quả lệnh thực tế sau thực thi, không dùng các kết quả lịch sử để tuyên bố PASS cho commit này.

## 10. Evidence Index

[Evidence README](evidence/README.md), [environment discovery](evidence/environment-discovery.json). Dữ liệu lịch sử ở `../261026-immersive-museum-redesign/evidence/after-profile.json` là software/fixture, không phải measurement mới.

## 11. Final Acceptance

Desktop>=60: NOT MEASURED. Mobile>=30 trên tối thiểu ba cấu hình vật lý: NOT MEASURED. Pacing/GPU memory/10 phút trên thiết bị thật: NOT MEASURED. Không push, tạo PR hoặc merge.
