import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import {
  ConflictException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import { PublicReportsController } from '../controllers/public-reports.controller';
import { ReportsController } from '../controllers/reports.controller';
import { ContentReportsService } from '../services/content-reports.service';

const UUID = 'c1111111-1111-4111-1111-111111111111';

async function makeApp(mock: Partial<ContentReportsService>): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [ReportsController, PublicReportsController],
    providers: [{ provide: ContentReportsService, useValue: mock }],
  })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  return app;
}

describe('Reports HTTP', () => {
  const apps: INestApplication[] = [];
  after(async () => {
    await Promise.all(apps.map((a) => a.close()));
  });

  it('public POST /public/reports: 400 khi thiếu trường bắt buộc', async () => {
    const app = await makeApp({ create: () => Promise.resolve({} as never) });
    apps.push(app);

    await request(app.getHttpServer()).post('/public/reports').send({}).expect(400);
  });

  it('public POST /public/reports: 201 khi hợp lệ', async () => {
    const app = await makeApp({
      create: () => Promise.resolve({ id: UUID, status: 'open' } as never),
    });
    apps.push(app);

    const res = await request(app.getHttpServer())
      .post('/public/reports')
      .send({ exhibitId: 'e1111111-1111-4111-8111-111111111111', category: 'wrong_info', message: 'Sai' })
      .expect(201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'open');
  });

  it('public POST /public/reports: 400 khi category không nằm trong danh mục cố định', async () => {
    const app = await makeApp({ create: () => Promise.resolve({} as never) });
    apps.push(app);

    await request(app.getHttpServer())
      .post('/public/reports')
      .send({ exhibitId: 'e1111111-1111-4111-8111-111111111111', category: 'tự nhập', message: 'Sai' })
      .expect(400);
  });

  it('public POST /public/reports: 400 khi message chỉ có khoảng trắng', async () => {
    const app = await makeApp({ create: () => Promise.resolve({} as never) });
    apps.push(app);

    await request(app.getHttpServer())
      .post('/public/reports')
      .send({ exhibitId: 'e1111111-1111-4111-8111-111111111111', category: 'wrong_info', message: '   ' })
      .expect(400);
  });

  it('POST /reports/:id/assign: 409 khi báo cáo không còn mở', async () => {
    const app = await makeApp({
      assign: () => Promise.reject(new ConflictException('Chỉ có thể tiếp nhận báo cáo đang mở')),
    });
    apps.push(app);

    const res = await request(app.getHttpServer())
      .post(`/reports/${UUID}/assign`)
      .send({})
      .expect(409);
    assert.equal(res.body.success, false);
  });

  it('POST /reports/:id/resolve: 400 khi thiếu kết luận', async () => {
    const app = await makeApp({ resolve: () => Promise.resolve({} as never) });
    apps.push(app);

    await request(app.getHttpServer()).post(`/reports/${UUID}/resolve`).send({}).expect(400);
  });
});
