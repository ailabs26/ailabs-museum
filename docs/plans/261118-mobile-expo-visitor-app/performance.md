# Hiệu năng mobile — ngưỡng và cách đo (MOB-E11-03)

Ngưỡng đánh dấu "đề xuất" **chưa được lead duyệt**.

| Chỉ số | Ngưỡng | Nguồn | Kết quả |
|---|---|---|---|
| Bundle Hermes mỗi nền tảng | ≤ 4 MB | đề xuất | 3,43 MB Android, 3,43 MB iOS (25/11/2026) — đạt |
| Cold start, máy tầm trung | ≤ 3 s | test-plan §7 | chưa đo |
| Phòng 3D, máy tầm trung | ≥ 30 fps | test-plan §7 | chưa đo |
| RAM khi mở phòng 5 model (Android, TOTAL PSS) | ≤ 600 MB | đề xuất | chưa đo |
| RAM sau 10 lần mở/đóng phòng so với lần 1 | tăng ≤ 10% | test-plan §7 (không rò), con số là đề xuất | chưa đo |

## Bundle

`cd mobile && npm run perf:bundle` — vượt `scripts/bundle-budget.json` thì exit 1. Chưa gắn CI (CI chưa có job mobile). Script luôn tách sourcemap; không tách thì file lớn hơn khoảng 65% và không so sánh được.

Nguồn lớn nhất (chưa nén): react-native 2,1 MB, three 1,4 MB, Sentry hơn 1,2 MB.

## Khởi động

- Bản dev in `[startup] N ms (JS)`: từ lúc bundle chạy tới khung hình đầu, **không gồm phần native**. Chỉ dùng để so sánh trước/sau.
- Cold start đầy đủ, bản release, 5 lần, lấy trung vị:
  - Android: `adb shell am force-stop com.auramuseum.mobile` rồi `adb shell am start -W -n com.auramuseum.mobile/.MainActivity`, đọc `TotalTime`.
  - iOS: Xcode Instruments, mẫu App Launch.

## Bộ nhớ và fps 3D (bản release, máy thật)

1. Mở app, vào phòng có 5 model, chờ tải xong. Android: `adb shell dumpsys meminfo com.auramuseum.mobile`, ghi TOTAL PSS. iOS: Xcode Memory gauge.
2. Thoát ra, vào lại 10 lần; chờ 30 giây; đo lại.
3. Mở AR rồi thoát, đo lại.
4. Di chuyển trong phòng 60 giây, ghi fps thấp nhất và trung bình cùng perf tier.

Ghi vào bảng: máy, hệ điều hành, commit, tier, số đo. Máy theo `test-plan.md` §5.
