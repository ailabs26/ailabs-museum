import 'reflect-metadata';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { TrustProxy } from './config/app.config';
import { PermissionDeniedFilter } from './modules/audit/filters/permission-denied.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { MEDIA_DELIVERY_ROUTE } from './modules/media/controllers/media-delivery.controller';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Sau reverse proxy: lấy IP client thật từ X-Forwarded-For cho rate limit, phiên, audit (TRUST_PROXY).
  app.set('trust proxy', config.getOrThrow<TrustProxy>('app.trustProxy'));

  // Mọi API dưới /api (xem 06-api-contract.md). Riêng file media giữ URL /media/... (ngoài
  // prefix) — được phân phối có kiểm soát bởi MediaDeliveryController.
  app.setGlobalPrefix(config.getOrThrow<string>('app.apiPrefix'), {
    exclude: [{ path: MEDIA_DELIVERY_ROUTE, method: RequestMethod.GET }],
  });

  // Đọc refresh token từ httpOnly cookie (AuthController).
  app.use(cookieParser());

  app.enableCors({
    origin: config.getOrThrow<string>('app.frontendOrigin'),
    credentials: true,
    // Retry-After không thuộc header CORS mặc định: phải mở để FE báo đúng số giây chờ khi bị 429.
    exposedHeaders: ['Retry-After'],
  });

  // Validation + chuẩn hóa response + chuẩn hóa lỗi (global)
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  // Nest xét filter từ cuối: lỗi RBAC phải được audit trước filter lỗi tổng quát.
  app.useGlobalFilters(new AllExceptionsFilter(), app.get(PermissionDeniedFilter));

  // Swagger tại /api/docs, có ô nhập Bearer token (dùng từ PR #D)
  const swagger = new DocumentBuilder()
    .setTitle('Aura Museum API')
    .setDescription('API cho bảo tàng WebXR 3D-WEB-03 (public read + Admin CMS).')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  await app.listen(config.getOrThrow<number>('app.port'));
}

void bootstrap();
