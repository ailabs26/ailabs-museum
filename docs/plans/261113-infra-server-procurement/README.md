# Đề xuất cấp phát máy chủ — AILabs Museum (2026-11-13)

Tài liệu phục vụ **xin cấp phát/mua sắm server vật lý** (sở hữu lâu dài) để triển khai
hệ thống lên production, thay cho thuê VPS theo tháng.

| File | Nội dung |
|---|---|
| [`server-procurement-request.md`](server-procurement-request.md) | Tài liệu chính trình người duyệt: cấu hình đề xuất, cơ sở sizing, mạng/CDN, backup, bảo mật, BOM, câu hỏi cần quyết định. |

**Liên quan:** kiến trúc triển khai Docker + storage đã có tại
[`../261017-0119-docker-vps-minio-deployment/`](../261017-0119-docker-vps-minio-deployment/).

**Định hướng đã chốt:** sở hữu phần cứng (CapEx), quy mô tải lớn/cao điểm sự kiện,
phục vụ cả web và app mobile (Expo/React Native) gồm phòng 3D.
