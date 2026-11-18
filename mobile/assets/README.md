# Assets

Cần bổ sung các asset thật trước khi build (MOB-E1-04):

| File | Kích thước | Mục đích |
| --- | --- | --- |
| `icon.png` | 1024×1024 | App icon |
| `adaptive-icon.png` | 1024×1024 (foreground) | Android adaptive icon |
| `splash.png` | ~1284×2778 | Splash screen |

Tạo nhanh bằng `npx expo-asset` hoặc thiết kế theo brand (teal `#0F766E`). `app.config.ts` đã tham chiếu các đường dẫn này.
