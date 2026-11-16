import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

/**
 * Cấu hình Swagger/OpenAPI dùng chung cho cả server chạy thật (`main.ts`) và
 * script xuất spec tĩnh (`scripts/export-openapi.ts`). Tập trung ở một nơi để
 * tài liệu đã xuất bản (`docs/api/openapi.json`) luôn khớp với trang `/api/docs`.
 */

/** Đường dẫn Swagger UI tương đối với gốc API (không có dấu `/` đầu). */
export const OPENAPI_DOCS_PATH = 'api/docs';

/** Phiên bản spec; đồng bộ với `package.json` của back-end. */
export const OPENAPI_VERSION = '0.1.0';

/** Build đối tượng cấu hình OpenAPI (title, mô tả, version, bearer auth). */
export function buildOpenApiConfig(): Omit<OpenAPIObject, 'paths'> {
  return new DocumentBuilder()
    .setTitle('Aura Museum API')
    .setDescription(
      [
        'API cho bảo tàng WebXR 3D-WEB-03 — gồm nhóm public read (Visitor) và Admin CMS (RBAC).',
        '',
        'Xác thực: Admin dùng JWT access token (nhấn **Authorize**, nhập `Bearer <access_token>`).',
        'Đối tác dùng partner API key qua header riêng (xem nhóm `partner`).',
      ].join('\n'),
    )
    .setVersion(OPENAPI_VERSION)
    .addBearerAuth()
    .build();
}

/** Tạo OpenAPI document từ ứng dụng Nest đã khởi tạo. */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  return SwaggerModule.createDocument(app, buildOpenApiConfig());
}
