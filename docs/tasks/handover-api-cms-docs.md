# Task: Bàn giao hệ thống, nghiệm thu, xuất bản API Docs & Hướng dẫn CMS

Người phụ trách: Quang (`ducqwang`). Nhánh `docs/system-handover-api-cms-guide` → PR vào `dev`.

## Bối cảnh

Giai đoạn kết thúc dự án cần: hoàn thiện bàn giao hệ thống, nghiệm thu, và **xuất bản**
tài liệu API (Swagger/OpenAPI) + Hướng dẫn sử dụng CMS. Swagger đã chạy động tại
`/api/docs` (27 controller gắn `@ApiTags`, 143 `@ApiOperation`) nhưng chưa có spec tĩnh
để chia sẻ/chốt theo commit; chưa có tài liệu bàn giao/nghiệm thu/hướng dẫn CMS tập trung.

## Thay đổi

### API Docs (Swagger/OpenAPI)
- `back-end/src/config/swagger.config.ts`: tách cấu hình OpenAPI dùng chung cho `main.ts`
  và script export → tài liệu đã xuất bản luôn khớp server.
- `back-end/scripts/export-openapi.ts` + npm script `openapi:export`: sinh
  `docs/api/openapi.json` ở **Nest preview mode** (không khởi tạo provider, không kết nối
  DB → chạy được trong CI). `tsconfig.scripts.json` + cập nhật `.eslintrc.cjs` để script
  vẫn typecheck/lint.
- `docs/api/`: `openapi.json` (OpenAPI 3.0.0, 96 path, 32 schema), `index.html` (Redoc tĩnh),
  `README.md` (hướng dẫn xem + sinh lại).

### Tài liệu bàn giao & nghiệm thu
- `docs/handover/system-handover.md`: kiến trúc, env BE/FE, cài đặt/chạy/triển khai,
  migration/seed, media, CI, runbook.
- `docs/handover/acceptance-report.md`: đối soát 18 nhóm FR §6 + NFR/BR với bằng chứng,
  cổng chất lượng (checklist), chữ ký nghiệm thu.
- `docs/handover/README.md` (index) + mục "Tài liệu" trong README gốc.

### Hướng dẫn CMS
- `docs/guides/cms-user-guide.md`: đăng nhập/2FA, RBAC 3 vai trò (đúng
  `DEFAULT_ROLE_PERMISSIONS`), luồng revision, hướng dẫn từng màn hình admin, xử lý sự cố.

## Kiểm chứng

- `npm run openapi:export` → 96 path; back-end `typecheck`/`lint`/`build` PASS.
- Không đổi logic runtime: thay đổi back-end chỉ là refactor cấu hình Swagger (hành vi
  `/api/docs` giữ nguyên).

## Chưa làm / ghi chú

- Chữ ký nghiệm thu và tick cổng chất lượng ở `acceptance-report.md` do bên nghiệm thu
  thực hiện trên môi trường nghiệm thu.
- Khi thêm/sửa endpoint hoặc DTO: chạy lại `npm run openapi:export` và commit `openapi.json`.
