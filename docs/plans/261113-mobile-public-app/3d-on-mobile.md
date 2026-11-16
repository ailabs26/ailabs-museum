# Phòng 3D trên mobile — ghi chú kỹ thuật & spike

> Phần rủi ro cao nhất của app. Làm **spike sớm** (ngay sau Phase 1) để chốt khả thi và
> hiệu năng trước khi đầu tư UI/luồng đầy đủ.

## 1. Stack đề xuất

| Lớp | Web hiện tại | Mobile (Expo) |
|---|---|---|
| Render engine | `three` | `three` (dùng lại) |
| React binding | `@react-three/fiber` | `@react-three/fiber/native` |
| GL context | WebGL (canvas) | **`expo-gl`** (GLView → GL context thật của thiết bị) |
| Loader/tiện ích | three loaders | **`expo-three`** (`loadAsync`, `Renderer`) |
| Tải GLB | fetch/loader | `expo-asset` + GLTFLoader qua `expo-three` |
| Nén hình học | Draco (tùy) | Draco/Meshopt — **ưu tiên** để giảm tải máy yếu |

> `@react-three/fiber/native` cho phép **viết cảnh bằng cùng mô hình r3f** như web → phần
> lớn logic dựng cảnh (đặt mô hình, ánh sáng, camera) tái dùng được về mặt khái niệm; chỉ
> khác tầng GL/context và cử chỉ cảm ứng.

## 2. Mục tiêu spike (chốt khả thi)

- [ ] Dựng `GLView`/`Canvas` tối thiểu, hiển thị 1 khối hình + ánh sáng ổn định 60fps.
- [ ] Tải **1 GLB thật** của hiện vật qua `expo-three`, hiển thị đúng vật liệu/kích thước.
- [ ] Camera điều khiển **cảm ứng** (1 ngón xoay, 2 ngón zoom/pan) mượt.
- [ ] Đo FPS + RAM trên **máy Android phổ thông/yếu**, không chỉ máy cao cấp/iPhone mới.
- [ ] Thử GLB lớn (~20 MB) để biết ngưỡng tải/nghẽn.
- [ ] Kiểm tra mất/khôi phục GL context khi app vào nền rồi quay lại.

**Tiêu chí đạt spike:** GLB thật hiển thị + điều khiển mượt ở mức chấp nhận trên máy phổ
thông; xác định được ngưỡng kích thước/LOD an toàn.

## 3. Chiến lược hiệu năng

- **Ngân sách tải:** giới hạn kích thước GLB; nén **Draco/Meshopt**; sinh **LOD** (bản nhẹ
  cho mobile) — có thể làm phía pipeline media (roadmap backend) hoặc tải biến thể nhẹ.
- **Tải dần:** chỉ tải mô hình trong tầm nhìn/khi cần; placeholder/skeleton khi đang tải.
- **Cache đĩa:** cache GLB/ảnh đã tải (qua `expo-file-system`/CDN cache) để lần sau nhanh.
- **Giảm chuyển động:** tôn trọng cài đặt hệ thống; hạ chất lượng khi pin yếu/máy nóng.
- **Giải phóng tài nguyên:** dispose geometry/material/texture khi rời cảnh để tránh rò RAM.

## 4. Fallback (bắt buộc)

Thiết bị không đủ khả năng (WebGL/GL lỗi, máy quá yếu, GLB lỗi) → **chuyển sang đọc 2D**,
giữ phiên guided tour nếu đang có (tái dùng tư duy `SceneFallback` + logic PR #180). Không
để app crash hay treo ở màn 3D.

## 5. Liên quan guided tour

Phòng 3D là một mode của **Guided Tour 2D↔3D** (Task 06). Logic dwell/arrival/next là thuần
TS (đã có ở web, gồm PR #180) → port sang mobile; chỉ tầng camera/GL là viết lại cho native.

## 6. Rủi ro & mở

- Hiệu năng GLB lớn trên máy yếu là ẩn số lớn nhất → **spike quyết định** phạm vi.
- Cần biến thể GLB nhẹ (LOD) hay không phụ thuộc kết quả spike; nếu cần, phối hợp pipeline
  media backend (ngoài phạm vi app, ghi roadmap).
- Khác biệt nhỏ giữa three trên web và `expo-three` (một số API/extension) — test GLB thật sớm.
