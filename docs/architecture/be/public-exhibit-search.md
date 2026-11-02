# API tìm kiếm hiện vật công khai (`GET /api/rooms/search`)

## 1. Endpoint & Hợp đồng dữ liệu (Contract)

- **Route:** `GET /api/rooms/search` (`@Public()`, đặt trước `GET /api/rooms/:slug` trong `ExhibitsController`)
- **Query parameters (`PublicSearchQueryDto`):**
  - `q` (`string`, tùy chọn, tối đa 200 ký tự): từ khóa tìm kiếm (ILIKE không phân biệt hoa thường trên tên phòng, tên hiện vật `vi`/`en` và mô tả `vi`/`en`). Ký tự `%`, `_`, `\` được escape thành ký tự thường (`ESCAPE '\\'`).
  - `roomId` (`UUID v4`, tùy chọn): lọc hiện vật trong một phòng cụ thể; sai định dạng UUID → **400 Bad Request**.
  - `page` (`int >= 1`, mặc định `1`): trang hiện tại.
  - `pageSize` (`int 1..100`, mặc định `20`): kích thước trang; vượt ngưỡng hoặc `< 1` → **400 Bad Request**.
  - `sort`: kế thừa từ `PaginationQueryDto` nhưng **bị bỏ qua** để bảo toàn thứ tự ổn định toàn cục.
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": [ /* PublicExhibitDto[] */ ],
    "message": null,
    "meta": {
      "page": 1,
      "pageSize": 20,
      "total": 14
    }
  }
  ```

## 2. Bất biến bảo mật & Thứ tự kết quả (Invariants)

1. **Ranh giới nội dung công khai:**
   - Hiện vật phải có `isDeleted = false`, `visibility = 'visible'`, `archivedAt IS NULL`, `publishedRevisionId IS NOT NULL`, và `publishedRevision.state = 'approved'`.
   - Phòng chứa hiện vật (`INNER JOIN rooms`) bắt buộc có `status = 'active'` và `isDeleted = false`. Hiện vật đã duyệt nhưng nằm trong phòng nháp/lưu trữ/đã xóa tuyệt đối không xuất hiện.
2. **Tìm kiếm an toàn trên JSONB:**
   - Chỉ đối chiếu trên các trường hiển thị công khai (`room.name`, `content->'name'->>'vi'`, `content->'name'->>'en'`, `content->'description'->>'vi'`, `content->'description'->>'en'` cùng nhánh chuỗi thuần khi `jsonb_typeof = 'string'`).
   - Không `CAST(publishedRevision.content AS text)` để tránh khớp nhầm tên khóa JSON (`position`, `placeholderColor`) hoặc dữ liệu nội bộ (`#8b7355`).
3. **Phân trang 2 bước & Thứ tự xác định (Total Order):**
   - Bước 1 (`buildPublicSearchIdQuery`): chọn danh sách `id` của trang hiện tại với `.select(['exhibit.id', 'exhibit.displayOrder', 'exhibit.roomId'])` (đảm bảo mọi cột trong `ORDER BY` đều có mặt trong subquery `distinctAlias` của TypeORM) và sắp xếp cố định:
     ```sql
     ORDER BY exhibit.room_id ASC, exhibit.display_order ASC, exhibit.id ASC
     ```
     (khớp composite index `IDX_exhibits_room_order_id`).
   - Bước 2 (`searchPublicExhibits`): nạp đầy đủ quan hệ media và hotspots cho các `id` của trang, sau đó sắp lại theo đúng thứ tự `ids` của Bước 1.
4. **Bảo vệ xung đột route `/rooms/search` vs `/rooms/:slug`:**
   - Route `@Get('search')` khai báo trước `@Get(':slug')`.
   - `CreateRoomDto` chặn danh sách slug dành riêng `RESERVED_ROOM_SLUGS = ['search']` (phòng vệ 2 lớp).

