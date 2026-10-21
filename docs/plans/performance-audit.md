# Performance audit

## Đã đo trên bản build local

- Lệnh `npm run build` ở front-end hoàn thành; Vite báo JS chính **1,084.99 kB** (gzip **298.98 kB**) và CSS **7.81 kB** (gzip **2.61 kB**). Đây là kích thước bundle, không phải tốc độ tải hay FPS.
- Vite cảnh báo chunk JS lớn hơn 500 kB. Three.js/R3F chiếm phần lớn; cần đo tải trang và tách chunk trước khi công bố hiệu năng.

## Kiểm thử tiếp theo

1. Dùng Chrome Performance/Lighthouse trên desktop và Android thật: đo LCP, INP, memory, thời gian tải scene và kích thước network. Ghi thông số máy/network.
2. Đo FPS/frametime khi đứng yên, di chuyển, mở bảng hiện vật và vào VR; mục tiêu ban đầu 60 FPS web, tần số native của kính VR. Chưa có số đo FPS thực tế.
3. Thay hình khối bằng GLB đã nén (Draco/Meshopt), texture WebP/KTX2 và LOD khi có asset thật. Kiểm tra draw calls, polygon, texture memory, chi phí raycast.
4. Kiểm tra chế độ giảm chuyển động, DPR trên mobile và thời gian khôi phục khi WebGL context lost.

Không có kết luận đạt/không đạt hiệu năng thiết bị ở giai đoạn này.
