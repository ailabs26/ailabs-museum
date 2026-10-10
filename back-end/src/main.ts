import 'reflect-metadata';
import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { static as expressStatic } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './core/http/all-exceptions.filter';
import { ResponseInterceptor } from './core/http/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Mọi API dưới /api (xem 06-api-contract.md)
  app.setGlobalPrefix('api');

  // Đọc refresh token từ httpOnly cookie (AuthController).
  app.use(cookieParser());

  app.enableCors({
    origin: config.getOrThrow<string>('FRONTEND_ORIGIN'),
    credentials: true,
  });

  // Validation + chuẩn hóa response + chuẩn hóa lỗi (global)
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Media tĩnh (không chịu prefix /api)
  app.use('/media', expressStatic(join(process.cwd(), 'public', 'media')));

  // Swagger tại /api/docs, có ô nhập Bearer token (dùng từ PR #D)
  const swagger = new DocumentBuilder()
    .setTitle('Aura Museum API')
    .setDescription('API cho bảo tàng WebXR 3D-WEB-03 (public read + Admin CMS).')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  await app.listen(config.getOrThrow<number>('PORT'));
}

void bootstrap();
