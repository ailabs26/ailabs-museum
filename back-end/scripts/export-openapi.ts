/**
 * Xuất OpenAPI spec tĩnh của Aura Museum API ra `docs/api/`.
 *
 * Dùng Nest **preview mode** nên KHÔNG khởi tạo provider và KHÔNG kết nối
 * database — chỉ quét metadata route/DTO để sinh spec. Nhờ đó chạy được trong
 * CI hoặc máy không có DB.
 *
 *   npm run openapi:export        # trong thư mục back-end/
 *
 * Spec sinh ra dùng chung cấu hình với Swagger UI ở `/api/docs`
 * (src/config/swagger.config.ts), nên tài liệu đã xuất bản luôn khớp server.
 */
import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Đặt env an toàn TRƯỚC khi nạp AppModule: ConfigModule chạy validate ngay khi
// module được import. Chỉ DATABASE_URL là bắt buộc và không có default; preview
// mode không thực sự kết nối nên giá trị giả này không bao giờ được dùng tới.
process.env.NODE_ENV ||= 'development';
process.env.DATABASE_URL ||= 'postgres://openapi:openapi@localhost:5432/openapi_export';

async function main(): Promise<void> {
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../src/app.module');
  const { createOpenApiDocument, OPENAPI_VERSION } = await import('../src/config/swagger.config');

  // preview: true → graph được dựng để quét route nhưng provider không chạy.
  const app = await NestFactory.create(AppModule, { preview: true, logger: false });
  const document = createOpenApiDocument(app);

  const outDir = join(__dirname, '..', '..', 'docs', 'api');
  mkdirSync(outDir, { recursive: true });

  const jsonPath = join(outDir, 'openapi.json');
  writeFileSync(jsonPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  report(jsonPath, document);

  await app.close();
  console.log(`[openapi] Xong. Spec version ${OPENAPI_VERSION}.`);
}

function report(path: string, document: { paths?: Record<string, unknown> }): void {
  const paths = Object.keys(document.paths ?? {}).length;
  console.log(`[openapi] Đã ghi ${relative(path)} (${paths} path).`);
}

function relative(abs: string): string {
  const root = join(__dirname, '..', '..');
  return abs.startsWith(root) ? abs.slice(root.length + 1).replace(/\\/g, '/') : abs;
}

main().catch((error) => {
  console.error('[openapi] Lỗi khi xuất spec:', error);
  process.exitCode = 1;
});
