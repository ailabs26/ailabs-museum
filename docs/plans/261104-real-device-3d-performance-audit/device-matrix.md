# Device matrix

Ngày discovery: 2026-11-04 (Asia/Saigon). Chỉ ghi những gì quan sát được, không suy đoán điện thoại của nhóm.

| ID | Thiết bị | CPU/GPU/RAM/OS đã đọc | Truy cập | Phạm vi |
| --- | --- | --- | --- | --- |
| D01 | ASUS Vivobook X1405VA | i5-13500H, 16 logical processors; Intel Iris Xe driver 32.0.101.7076; RAM 16786575360 bytes; Windows 11 10.0.26200 | Edge156.0.4314.58 headless, ANGLE Intel/D3D11 đã đối chiếu host | Có3 P03 fixture raw; phiên dài/lifecycle thu riêng, không certify presented FPS/live room |
| A01 | Android thấp | N/A — chưa có máy | BLOCKED — PHYSICAL DEVICE REQUIRED | P01–P10, tier thực tế |
| A02 | Android trung bình | N/A — chưa có máy | BLOCKED — PHYSICAL DEVICE REQUIRED | P01–P10, cùng workload A01 |
| A03 | Android cao | N/A — chưa có máy | BLOCKED — PHYSICAL DEVICE REQUIRED | P01–P10, cùng workload A01 |
| I01 | iPhone/Safari | N/A — chưa có máy/macOS inspector | NOT MEASURED | Coverage gap iOS |

Không có adb trong PATH/SDK mặc định hoặc process ADB; truy vấn PnP present chỉ lấy tên/lớp Android/iPhone/WPD không trả về mục nào. Đây là discovery khả năng truy cập, không chứng minh không tồn tại điện thoại khác trong mạng. Không có quyền remote debug máy không được kết nối.

Mỗi máy thực đo phải ghi model, SoC, CPU/GPU, RAM, OS, browser/version, viewport/DPR, refresh rate quan sát (hoặc unavailable), WebGL/renderer, quality, network, battery %, nhiệt độ/thermal state, power saving, nguồn điện, build SHA và fixture/live. Hints `deviceMemory`/`hardwareConcurrency` không thay thế thông số vật lý. AdapterRAM của integrated GPU không phải GPU memory đang dùng và không dùng làm kết quả memory.

Kịch bản mọi máy: P01 cold/P02 warm (3 lần riêng); P03 continuous/P04 selection/P05 complex (10s warmup + 30–60s x3); P06 đổi phòng x10; P07 >=10 phút có checkpoint; P08 mở/đóng x10; P09 portrait/landscape; P10 fallback/context loss có kiểm soát. Thứ tự và thời gian nghỉ giống nhau; không so fixture 5 hình khối với live room nhiều GLB.

D01: viewport1280×720, DPR1, balanced cap1.5/shadow1024/anisotropy4; WebGL2; refresh vật lý unavailable (không suy ra từ90 submission FPS). Loopback fixture5 minh họa/0GLB, build source `d4e1d56`. Battery/AC trước run ở `evidence/desktop/desktop-environment.json`; Balanced power plan, thermal/battery-saver unavailable. Chưa có P09 xoay phone vật lý hoặc headset WebXR.
