# Fallback tests

| Tình huống | Kỳ vọng | Trạng thái |
| --- | --- | --- |
| `navigator.xr` không có hoặc `immersive-vr` trả false | Ẩn nút VR; cảnh 3D và danh sách vẫn dùng được | Chưa chạy trên browser |
| `requestSession` bị từ chối | Hiện thông báo lỗi, không khóa tham quan web | Chưa chạy |
| WebGL không có | Hiện hướng dẫn và danh sách hiện vật 2D, mở transcript | Chưa chạy |
| API dừng hoặc trả lỗi | Thông báo lỗi có gợi ý kiểm tra API/DB | Chưa chạy trên browser |
| Media model GLB hỏng | GLTFLoader dùng hình khối placeholder | Chưa chạy với GLB hỏng |
| Hiện vật không có audio | Báo chưa có file audio, transcript vẫn đọc được | Chưa chạy trên browser |
| Trình duyệt không dùng chuột | Danh sách hiện vật chọn được bằng bàn phím | Chưa chạy thủ công |

Để thử API lỗi: dừng `back-end`, tải lại trang. Để thử WebGL thiếu: tắt WebGL trong cấu hình browser/test runner. Để thử VR cần kính tương thích hoặc môi trường giả lập WebXR; giả lập không thay thế kiểm thử kính thật.
