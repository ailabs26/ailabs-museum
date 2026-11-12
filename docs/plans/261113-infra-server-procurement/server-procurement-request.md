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

<!-- Các mục chi tiết được bổ sung ở các phần dưới. -->
