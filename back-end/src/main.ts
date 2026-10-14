import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { static as expressStatic } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import {
  DEFAULT_MEDIA_STORAGE_ROOTS,
  PUBLIC_MEDIA_URL_PREFIX,
} from './modules/media/services/media-storage.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Mọi API dưới /api (xem 06-api-contract.md)
  app.setGlobalPrefix(config.getOrThrow<string>('app.apiPrefix'));

  // Đọc refresh token từ httpOnly cookie (AuthController).
  app.use(cookieParser());

  app.enableCors({
    origin: config.getOrThrow<string>('app.frontendOrigin'),
    credentials: true,
  });

  // Validation + chuẩn hóa response + chuẩn hóa lỗi (global)
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Media tĩnh (không chịu prefix /api). nosniff: trình duyệt không được "đoán" lại
  // Content-Type — file upload luôn được phục vụ đúng kiểu đã kiểm tra.
  app.use(
    PUBLIC_MEDIA_URL_PREFIX,
    expressStatic(DEFAULT_MEDIA_STORAGE_ROOTS.publicRoot, {
      index: false,
      dotfiles: 'deny',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );

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
