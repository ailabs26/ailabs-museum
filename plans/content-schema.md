# Content schema — bản đầu

```text
Room (id, slug, name, description)
  1 ── n Exhibit (id, roomId, name, description, positionX/Y/Z,
                 displayOrder, transcript, placeholderShape/Color,
                 modelId?, imageId?, audioId?)
Media (id, kind: model|image|audio, url, mimeType, altText?)
```

- Tọa độ theo hệ Three.js: Y hướng lên, đơn vị hiện dùng tương đương mét trong phòng mẫu. `positionY` là tâm vật thể; `positionX/Z` đặt vị trí bục.
- `modelId`, `imageId`, `audioId` là khóa ngoại tùy chọn đến `Media`; ảnh mẫu hiện được phục vụ từ API `/media/placeholder-artifact.svg`. `transcript` ở Exhibit để luôn đọc được kể cả khi không phát audio.
- Migration tạo một Room và 5 Exhibit giả lập. Chúng không đại diện cho hiện vật lịch sử. Các mục `Media` chỉ chứa ảnh placeholder; chưa có GLB/audio thật.
- DTO `ExhibitContentDto` minh họa validation cho route ghi sau này: UUID, số tọa độ, màu hex, shape có giới hạn, tên dài tối đa 200. Khi triển khai CMS cần bổ sung DTO Room/Media, kiểm tra quan hệ media đúng loại, URL được phép, giới hạn dung lượng/MIME, chính sách transcript, xác thực/phân quyền và lịch sử xuất bản.
- API hiện tại: `GET /rooms`, `GET /rooms/:slug`, `GET /health`, `GET /media/*`. Dự kiến sau này tách route ghi dưới `/admin/*` có bảo vệ; Swagger `/docs` ghi rõ đây là API chỉ đọc.
