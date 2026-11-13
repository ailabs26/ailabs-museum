---
title: "Đề xuất cấp phát máy chủ triển khai hệ thống AILabs Museum"
description: "Tài liệu trình xin cấp server (phần cứng sở hữu) để triển khai production nền tảng bảo tàng số: back-end NestJS, front-end React, lưu trữ media 3D (GLB/ảnh/audio/phụ đề), phục vụ web và app mobile cho tải lớn / sự kiện cao điểm."
status: draft
audience: "Ban lãnh đạo / Bộ phận Hạ tầng CNTT / Tài chính (duyệt cấp phát phần cứng)"
prepared_for: "Xin cấp phát / mua sắm server (CapEx), không thuê VPS theo tháng"
owner: "Nhóm phát triển AILabs Museum"
created: 2026-11-13
---

# Đề xuất cấp phát máy chủ — AILabs Museum

> **Mục đích tài liệu:** Trình bày nhu cầu hạ tầng để triển khai hệ thống lên môi
> trường production, phục vụ xin **cấp phát/mua sắm máy chủ vật lý (sở hữu lâu dài)**
> thay cho thuê VPS theo tháng. Tài liệu nêu rõ cấu hình đề xuất, lý do kỹ thuật gắn
> với đặc thù tải, và các phương án theo mức ngân sách để cấp trên quyết định.

## 1. Tóm tắt cho người duyệt (TL;DR)

| Hạng mục | Đề xuất |
|---|---|
| Hình thức | Cấp phát **server vật lý sở hữu** (CapEx) + phụ trợ mạng/backup |
| Số lượng máy | **2** (1 máy ứng dụng chính + 1 máy backup/standby) |
| Cấu hình máy chính | 8–16 nhân vật lý · 32–64 GB RAM · 2× NVMe 1–2 TB (RAID1) · 1 Gbps |
| Cấu hình máy backup | 8 nhân · 16–32 GB RAM · 2–4 TB SSD/HDD (lưu bản sao) |
| Phần mềm | Ubuntu Server LTS + Docker (toàn bộ dịch vụ container hóa) |
| Dịch vụ thuê kèm (OPEX nhỏ) | Tên miền + **CDN** cho media/tĩnh ở cao điểm + đích backup ngoài |
| Quy mô phục vụ | Web + **app mobile (iOS/Android)**, tải lớn, có đợt sự kiện cao điểm |

**Vì sao sở hữu phần cứng:** tải có đặc thù phục vụ media 3D dung lượng lớn (GLB,
ảnh độ phân giải cao, audio, phụ đề) và lưu trữ tăng dần theo số hiện vật/revision →
chi phí thuê theo dung lượng/băng thông về lâu dài cao hơn và khó kiểm soát; dữ liệu
hiện vật là tài sản số của đơn vị nên giữ trên hạ tầng sở hữu giúp chủ động sao lưu,
bảo mật và tuân thủ.

## 2. Hệ thống cần triển khai & đặc thù tải

### 2.1. Thành phần phần mềm

| Thành phần | Công nghệ | Vai trò | Đặc tính tài nguyên |
|---|---|---|---|
| Back-end API | NestJS 10 + Node.js (TypeScript) | REST API, auth JWT, RBAC, kiểm duyệt, stream media | CPU + RAM theo số request đồng thời |
| Cơ sở dữ liệu | PostgreSQL 16 | Hiện vật, phòng, người dùng, audit, báo cáo | RAM cho cache, IO đĩa (NVMe) |
| Object storage | MinIO (S3-compatible) | Lưu GLB (mô hình 3D), ảnh, audio, phụ đề | **Dung lượng đĩa lớn**, băng thông đọc cao |
| Front-end web | React 18 + Vite (SPA tĩnh) | Giao diện khách + CMS quản trị | Nhẹ (phục vụ file tĩnh qua Nginx) |
| App mobile | **Expo / React Native (iOS + Android)** | Phân hệ public, gồm cả phòng 3D | Dùng chung API/CDN với web |
| Reverse proxy | Nginx + TLS (Let's Encrypt) | Điểm vào duy nhất, TLS, nén, cache | Nhẹ |
| Sao lưu | pg_dump + mirror MinIO (cron) | Backup DB + media ra ngoài máy chính | IO + dung lượng máy backup |

Toàn bộ chạy **container Docker** trên một stack `docker-compose` (đã có plan container
hóa tại `docs/plans/261017-0119-docker-vps-minio-deployment/`). Tài liệu này kế thừa
kiến trúc đó, chỉ nâng cấu hình phần cứng cho quy mô lớn và bổ sung tải từ app mobile.

### 2.2. Vì sao tải "nặng" hơn web thông thường

1. **Media 3D dung lượng lớn:** mỗi hiện vật có mô hình GLB (tối đa ~20 MB) + ảnh độ
   phân giải cao + audio thuyết minh + phụ đề đa ngôn ngữ. Lượt xem phòng 3D kéo nhiều
   MB dữ liệu → **băng thông đọc và IO đĩa** là điểm chịu tải chính.
2. **Lưu trữ tăng dần:** dung lượng tỉ lệ với *số hiện vật × số revision giữ lại*; cần
   headroom đĩa để không phải nâng cấp gấp.
3. **Hai kênh client:** web **và** app mobile cùng gọi API và tải media → tổng đồng thời
   cao hơn, đặc biệt khi có **sự kiện/triển lãm cao điểm** (nhiều khách quét QR vào xem
   cùng lúc).
4. **Render phía client:** dựng cảnh 3D chạy trên thiết bị người dùng (trình duyệt/điện
   thoại) → **server không cần GPU**; chi phí dồn vào CPU (API), RAM (DB), đĩa + băng
   thông (media).

## 3. Cấu hình server đề xuất (để cấp phát)

### 3.1. Máy chủ ứng dụng chính — *Khuyến nghị*

| Thành phần | Thông số khuyến nghị | Lý do |
|---|---|---|
| CPU | **8–16 nhân vật lý** (x86-64, ví dụ Xeon Silver/Gold hoặc EPYC) | NestJS API + stream media + Postgres cùng máy; headroom cho cao điểm |
| RAM | **32–64 GB ECC** | Postgres cache + MinIO + API; 64 GB nếu dữ liệu/đồng thời lớn |
| Đĩa hệ thống + dữ liệu | **2× NVMe SSD 1–2 TB, RAID1** | IO nhanh cho DB & media; RAID1 chống hỏng 1 ổ |
| (Tùy chọn) đĩa media riêng | +2–4 TB SSD/HDD cho bucket MinIO | Tách media khỏi DB khi dung lượng tăng |
| Mạng | **1 Gbps** (ưu tiên 1 IPv4 public tĩnh) | Băng thông tải GLB/ảnh ở cao điểm |
| Nguồn | **PSU dự phòng (redundant)** | Giảm downtime do hỏng nguồn |
| OS | Ubuntu Server 24.04 LTS | Khớp plan Docker hiện có |

### 3.2. Máy chủ backup / standby — *Khuyến nghị*

| Thành phần | Thông số | Lý do |
|---|---|---|
| CPU | 4–8 nhân | Chỉ chạy backup + sẵn sàng thay thế tạm |
| RAM | 16–32 GB | Đủ chạy stack ở chế độ dự phòng khi máy chính sự cố |
| Đĩa | **2–4 TB** (ưu tiên dung lượng) | Lưu nhiều kỳ `pg_dump` + bản mirror media |
| Mạng | 1 Gbps | Đồng bộ backup nhanh |

> Đặt máy backup ở **vị trí/tủ rack khác** (hoặc tối thiểu khác nguồn điện/switch) để
> không mất cả hai khi sự cố cục bộ.

### 3.3. Cấu hình tối thiểu — *nếu ngân sách hạn chế (giai đoạn đầu)*

| Thành phần | Tối thiểu |
|---|---|
| Số máy | 1 máy (chấp nhận rủi ro không có standby nóng) |
| CPU / RAM | 8 nhân / 32 GB |
| Đĩa | 2× NVMe 1 TB RAID1 |
| Backup | Bắt buộc có **đích backup ngoài máy** (NAS/máy khác/cloud object rẻ) |

**Rủi ro cấu hình tối thiểu:** không có máy dự phòng → khi máy chính hỏng, thời gian phục
hồi phụ thuộc mua/sửa phần cứng. Chỉ nên chọn nếu chấp nhận gián đoạn vài giờ–vài ngày.

## 4. Cơ sở ước tính (gắn cấu hình với tải)

> Số liệu dưới đây là **ước tính kỹ thuật** để biện giải cấu hình, không phải cam kết
> benchmark. Cần đo tải thật (load test) trước go-live để tinh chỉnh.

| Yếu tố | Ước tính | Hệ quả cấu hình |
|---|---|---|
| Khách đồng thời mục tiêu | **500+** (cao điểm sự kiện) | CPU nhiều nhân cho API; CDN gánh media |
| Dung lượng 1 lượt xem phòng 3D | ~5–30 MB (GLB + ảnh + audio) | Băng thông đọc là nút cổ chai → cần CDN khi đông |
| Media mỗi hiện vật | GLB ≤ 20 MB + ảnh/audio/phụ đề | ~30–60 MB/hiện vật × revision → đĩa TB |
| Tăng trưởng lưu trữ | Theo số hiện vật × revision giữ lại | Chừa headroom đĩa 2–3× hiện tại |
| DB | Chủ yếu đọc (catalog), ghi vừa (audit/report) | RAM cache + NVMe là đủ, chưa cần cụm DB |

**Nguyên tắc:** CPU/RAM/đĩa của **một máy mạnh** đủ cho tải thường ngày; **cao điểm sự
kiện** được hấp thụ bằng **CDN đứng trước media + file tĩnh** (xem mục 5), tránh phải mua
dư phần cứng chỉ để phục vụ vài đợt cao điểm.

## 5. Mạng, tên miền & CDN cho cao điểm

| Hạng mục | Nhu cầu | Ghi chú |
|---|---|---|
| Tên miền | 1 tên miền chính thức | Dùng chung: `/` web, `/api` API, `/media` file; app mobile gọi cùng domain |
| IP public tĩnh | 1 IPv4 | Cho TLS + CDN origin |
| TLS | Let's Encrypt (miễn phí, tự gia hạn) | Đã có trong plan Nginx |
| **CDN** | **Khuyến nghị bật ở cao điểm** cho `/media` + tĩnh | Cloudflare/tương đương; giảm mạnh tải băng thông & bảo vệ DDoS |
| Băng thông Internet | ≥ 1 Gbps hoặc đủ gánh origin sau CDN | Nếu đặt on-prem, kiểm tra đường truyền thực tế của đơn vị |
| Cổng mở | 22 (SSH hạn chế IP), 80, 443 | MinIO/DB **không** mở ra ngoài |

> **CDN là đòn bẩy chi phí chính:** thay vì mua server rất mạnh chỉ để chịu băng thông
> media lúc cao điểm, CDN cache GLB/ảnh (file bất biến theo hash) ở biên, server chỉ phục
> vụ lần đầu. Đây là khoản OPEX nhỏ, co giãn theo lưu lượng.

## 6. Sao lưu & phục hồi (bắt buộc trước go-live)

| Hạng mục | Phương án | Mục tiêu |
|---|---|---|
| Backup DB | `pg_dump` hằng đêm, xoay vòng 7 ngày / 4 tuần | Khôi phục điểm gần nhất |
| Backup media | `mc mirror` bucket MinIO → máy backup/đích ngoài | Không mất GLB/ảnh |
| Đích backup | **Máy backup riêng** (mục 3.2) + tùy chọn object storage rẻ (R2/B2) | Quy tắc 3-2-1: ≥1 bản ngoài máy chính |
| Kiểm thử phục hồi | **Thử restore** DB + media trước khi go-live và định kỳ | Backup không restore được = không có backup |
| Snapshot | Nếu nhà cung cấp/ảo hóa hỗ trợ snapshot định kỳ | Phục hồi nhanh toàn máy |

**RPO/RTO đề xuất giai đoạn đầu:** RPO ≤ 24 giờ (mất tối đa 1 ngày dữ liệu), RTO vài giờ
với máy standby. Có thể siết chặt hơn (WAL archiving) khi hệ thống quan trọng hơn.

## 7. Bảo mật & vận hành

- **Bề mặt tấn công tối thiểu:** chỉ mở 80/443 ra ngoài; SSH giới hạn IP; DB và MinIO
  console chỉ nghe nội bộ (`127.0.0.1`), truy cập qua SSH tunnel.
- **Phân quyền storage:** app dùng user MinIO riêng, policy chỉ trên bucket của app;
  không dùng root key cho ứng dụng.
- **Swagger/API docs:** tắt ở production.
- **`trust proxy`:** bật 1 hop để log/rate-limit đúng IP khách sau Nginx/CDN.
- **Cập nhật:** vá OS/Docker image định kỳ; dùng image gắn tag cố định, không `latest`.
- **Giám sát tối thiểu:** `docker stats` + uptime check ngoài + cảnh báo dung lượng đĩa;
  nâng lên Prometheus/Grafana khi cần (YAGNI ở giai đoạn đầu).
- **Nhật ký:** audit log của hệ thống đã có sẵn ở tầng ứng dụng (module `audit`).

## 8. Danh mục đề nghị cấp phát (BOM)

### 8.1. Phần cứng (CapEx — xin cấp/mua)

- [ ] **01 × Server ứng dụng chính** — spec mục 3.1 (khuyến nghị) hoặc 3.3 (tối thiểu)
- [ ] **01 × Server backup/standby** — spec mục 3.2 *(bỏ nếu chọn phương án tối thiểu, nhưng vẫn cần đích backup ngoài)*
- [ ] (On-prem) Vị trí đặt máy: tủ rack, điện, làm mát, **UPS** chống mất điện
- [ ] (On-prem) Switch/đi dây mạng, cổng uplink đủ băng thông

### 8.2. Dịch vụ kèm (OPEX — nhỏ, định kỳ)

- [ ] **Tên miền** chính thức (gia hạn hằng năm)
- [ ] **CDN** cho media + tĩnh (bật ở cao điểm; gói co giãn theo lưu lượng)
- [ ] (Tùy chọn) **Object storage ngoài** (Cloudflare R2 / Backblaze B2) làm đích backup thứ 3
- [ ] TLS: **miễn phí** (Let's Encrypt)

### 8.3. Không cần (giải trình để không bị tính dư)

- ❌ **GPU** — render 3D chạy ở thiết bị khách, server không dựng hình.
- ❌ **Cụm nhiều DB / Kubernetes** — một máy mạnh + Docker Compose đủ cho giai đoạn này.
- ❌ **Redis / message queue** — chưa có nhu cầu (YAGNI); thêm sau nếu phát sinh.
- ❌ **Thuê VPS theo tháng** — chủ trương sở hữu phần cứng (chính là mục đích tài liệu này).

## 9. Nội dung cần cấp trên / hạ tầng quyết định

1. **Hình thức đặt máy:** đặt tại phòng máy đơn vị (on-prem) hay thuê chỗ đặt (colocation)
   tại trung tâm dữ liệu? → ảnh hưởng điện/mạng/UPS và đường truyền.
2. **Ngân sách:** chọn cấu hình **khuyến nghị** (có standby) hay **tối thiểu** (1 máy)?
3. **Đường truyền Internet thực tế** tại nơi đặt máy (băng thông lên/xuống, IP tĩnh)?
4. **Tên miền chính thức** đã có chưa (cần cho TLS/CDN)?
5. **Đích backup ngoài:** dùng máy backup nội bộ là đủ hay cần thêm object storage ngoài?
6. **Mốc thời gian go-live / sự kiện cao điểm đầu tiên** để chốt tiến độ mua sắm & load test.

---

> **Bước tiếp theo sau khi được duyệt:** triển khai theo plan container hóa đã có
> (`docs/plans/261017-0119-docker-vps-minio-deployment/`) trên phần cứng được cấp, chạy
> **load test** mô phỏng cao điểm để xác nhận cấu hình trước khi mở cho công chúng.
