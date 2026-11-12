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
