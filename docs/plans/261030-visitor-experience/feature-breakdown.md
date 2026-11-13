# Phân rã tính năng

| Phần | Nghiệm thu | File sở hữu | Kiểm chứng / phụ thuộc |
|---|---|---|---|
| Persistence | v1 strict validation, giới hạn dung lượng, không DTO; đọc/ghi lỗi vẫn dùng RAM, cross-tab cleanup | helpers/visitorPersistence.ts, helpers/visitorState.ts, hooks/useVisitorStore.ts | Vitest version/JSON/schema/quota/blocked/update; nền cho F1/F2/F4/F5 |
| F1 Favorites | toggle card/detail, aria-pressed, keyboard, reload, filter trong phòng, rỗng/stale an toàn | ExhibitGrid optional renderActions; FavoriteButton; CollectionPage; ExhibitDetailPage | unit refs/dedupe/limit; E2E toggle/reload/filter/stale/errors |
| F2 Recent | ghi sau valid load; dedupe/mới trước/20; link đúng phòng; clear; không tracking | useResolvedVisitorExhibits, RecentlyViewed, detail effect | unit order/limit; E2E success/invalid/clear/reload/hidden room |
| F3 Compare | 2–3 mục, tray/remove/clear, vượt giới hạn status; đổi phòng giữ refs; responsive modal; fields thật | ExhibitComparison + CollectionPage | E2E max/deselect/room switch/unavailable/Escape/focus/mobile |
| F4 Reading | toggle/font 1–1.5/reset/persist; scoped width/line-height; headings/audio/transcript giữ nguyên | ReadingControls + detail CSS | unit settings; E2E keyboard/reload/reset/light-dark/mobile/zoom |
| F5 Notes | 2.000 ký tự, tạo/sửa/xóa; room+exhibit; sync autosave; error giữ draft/retry; thông báo local | VisitorNotes + visitorState | unit length/count; E2E isolation/rapid route/reload/quota/plain text |

Mỗi phần viết behavioral test trước, thấy RED rồi triển khai GREEN. Regression dùng fixtures public; không DB thật. Existing suite bảo vệ home/collection/detail/tour/report/audio/fallback. Không thêm endpoint/search/pagination.
