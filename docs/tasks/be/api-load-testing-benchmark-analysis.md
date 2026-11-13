# Báo cáo Phân tích Hiệu năng & Năng lực Chịu tải k6 (API Load Testing Benchmark)

> Tài liệu kỹ thuật hiệu năng & tải · Aura Museum  
> Người phụ trách: **Nguyễn Trọng Thành**  
> Tiêu chuẩn đáp ứng: **AC-49** (Public API Load & Performance SLA: $p95 \le 500\text{ ms}$, Error Rate $< 1\%$)

---

## 1. Mục tiêu & Phạm vi Thử nghiệm

Kiểm chứng năng lực phục vụ của các giao diện lập trình công khai (Public APIs) dành cho khách tham quan trực tuyến dưới áp lực tải đồng thời từ 100 đến 200 người dùng ảo (Concurrent Virtual Users - VUs).

### Tiêu chuẩn nghiệm thu cốt lõi (AC-49 SLA):
- **Thời gian phản hồi phân vị 95 ($p95$)**: $\le 500\text{ ms}$ cho toàn bộ các endpoint công khai.
- **Tỷ lệ lỗi HTTP ($4xx / 5xx$)**: $< 1.0\%$.
- **Tính khả dụng của hệ thống**: Không xảy ra nghẽn kết nối cơ sở dữ liệu (Connection Pool Exhaustion) hoặc sập tiến trình máy chủ.

---

## 2. Kịch bản & Cấu hình Thử nghiệm

### 2.1 Cấu hình Tải k6

```javascript
export const options = {
  scenarios: {
    visitor_exploration: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },   // Khởi động
        { duration: '1m', target: 100 },   // Baseline 100 CCU
        { duration: '2m', target: 200 },   // Peak target 200 CCU
        { duration: '30s', target: 0 },    // Hạ tải
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<500'],
    'http_req_failed': ['rate<0.01'],
  },
};
```

### 2.2 Các Endpoint Khảo sát (Trọng số truy cập thực tế)
1. `GET /api/public/rooms` (Trọng số 20%): Danh sách các phòng trưng bày đang mở cửa.
2. `GET /api/public/rooms/:slug` (Trọng số 45%): Dữ liệu chi tiết phòng, sơ đồ bục trưng bày và danh sách hiện vật đã xuất bản.
3. `GET /api/public/exhibits/:id/location` (Trọng số 20%): Tọa độ không gian 3D của hiện vật để camera định vị.
4. `GET /api/public/translations` (Trọng số 15%): Từ điển bản dịch giao diện đa ngôn ngữ.

---

## 3. Bảng Kết quả Đo lường Thực tế

Dữ liệu đo đạc trên môi trường máy chủ tiêu chuẩn (CPU 4 Cores, 8GB RAM, PostgreSQL 16 cục bộ):

| Cấp độ tải | Tổng Requests | Thông lượng (RPS) | Thời gian phản hồi $p50$ | Thời gian phản hồi $p95$ | Thời gian phản hồi $p99$ | Tỷ lệ lỗi (%) | Đánh giá SLA |
|---|---|---|---|---|---|---|---|
| **Smoke (5 VUs)** | 3.200 | ~105 req/s | 12 ms | 38 ms | 72 ms | 0.00% | ✅ **ĐẠT** |
| **Baseline (100 VUs)** | 58.400 | ~980 req/s | 35 ms | 120 ms | 215 ms | 0.00% | ✅ **ĐẠT** |
| **Peak Target (200 VUs)** | 114.200 | ~1.850 req/s | 68 ms | **245 ms** | 410 ms | **0.02%** | ✅ **ĐẠT (AC-49)** |
| **Stress Test (500 VUs)** | 230.000 | ~2.600 req/s | 185 ms | 480 ms | 820 ms | 0.15% | ⚠️ Ngưỡng bão hòa |

> **Kết luận**: Tại mức tải mục tiêu cao điểm 200 VUs, thời gian phản hồi $p95$ đạt **245 ms** (tốt hơn 51% so với ngưỡng quy định $\le 500\text{ ms}$), tỷ lệ lỗi chỉ **0.02%** (đạt xa yêu cầu $< 1\%$). Tiêu chí **AC-49 được nghiệm thu thành công**.

---

## 4. Phân tích Điểm nghẽn (Bottleneck Profiling) & Bài học Kinh nghiệm

1. **Khóa kết nối Database Connection Pool**:
   - Khi tăng tải lên trên 300 VUs, số lượng truy vấn đồng thời tới PostgreSQL đạt giới hạn kết nối mặc định (`max: 10`).
   - *Khắc phục*: Tăng kích thước kết nối TypeORM `extra: { max: 30, min: 5 }` kết hợp tái sử dụng Prepared Statements.
2. **Ảnh hưởng của Bộ đếm Tần suất (Rate Limiter Throttling)**:
   - Các kịch bản tải tập trung từ một dải IP phát sinh lỗi `429 Too Many Requests` do `ThrottlerGuard` bảo vệ mặc định.
   - *Khắc phục*: Trong môi trường kiểm thử chuyên dụng, cấu hình biến môi trường `THROTTLE_TTL` và `THROTTLE_LIMIT` nới rộng để phản ánh đúng năng lực xử lý thuần túy của ứng dụng.
3. **N+1 Query Elimination**:
   - Truy vấn `GET /rooms/:slug` được tối ưu hóa với `leftJoinAndSelect` tường minh trên bảng `exhibit_revisions`, loại bỏ hoàn toàn các truy vấn lặp đọc metadata truyền thông.

---

## 5. Khuyến nghị Kiến trúc Triển khai Production

- **Reverse Proxy Caching**: Kích hoạt bộ nhớ đệm Nginx micro-cache (TTL 5 giây) cho endpoint danh sách phòng và từ điển ngôn ngữ.
- **Node.js Cluster Mode**: Triển khai NestJS dưới chế độ Cluster (dùng PM2 hoặc Docker replicas) tương ứng với số lượng CPU cores của máy chủ để tối đa hóa hiệu năng xử lý song song.
