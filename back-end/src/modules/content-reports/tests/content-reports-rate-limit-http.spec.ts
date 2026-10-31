import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { performance } from 'node:perf_hooks';
import request from 'supertest';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import { reportsConfig } from '../../../config/reports.config';
import { publicReportsThrottleOptions } from '../content-reports.module';
import { PublicReportsController } from '../controllers/public-reports.controller';
import { ContentReportsService } from '../services/content-reports.service';

const EXHIBIT_ID = 'e1111111-1111-4111-8111-111111111111';

describe('Public report rate limit HTTP', () => {
  const apps: INestApplication[] = [];

  after(async () => {
    await Promise.all(apps.map((app) => app.close()));
  });

  async function makeApp(limit?: number, trustForwardedIp = false) {
    const previousLimit = process.env.PUBLIC_REPORT_RATE_LIMIT;
    if (limit === undefined) delete process.env.PUBLIC_REPORT_RATE_LIMIT;
    else process.env.PUBLIC_REPORT_RATE_LIMIT = String(limit);
    const created: Array<{ id: string; status: string }> = [];
    try {
      const moduleRef = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [reportsConfig] }),
          ThrottlerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: publicReportsThrottleOptions,
          }),
        ],
        controllers: [PublicReportsController],
        providers: [{
          provide: ContentReportsService,
          useValue: {
            create: () => {
              const report = { id: `report-${created.length + 1}`, status: 'open' };
              created.push(report);
              return Promise.resolve(report);
            },
          },
        }],
      }).compile();

      const app = moduleRef.createNestApplication();
      if (trustForwardedIp) app.getHttpAdapter().getInstance().set('trust proxy', 1);
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
      app.useGlobalInterceptors(new ResponseInterceptor());
      app.useGlobalFilters(new AllExceptionsFilter());
      await app.init();
      apps.push(app);
      return { app, created };
    } finally {
      if (previousLimit === undefined) delete process.env.PUBLIC_REPORT_RATE_LIMIT;
      else process.env.PUBLIC_REPORT_RATE_LIMIT = previousLimit;
    }
  }

  it('uses the default of five reports per client IP per minute', async () => {
    const { app, created } = await makeApp();

    for (let i = 1; i <= 5; i++) {
      const response = await request(app.getHttpServer())
        .post('/public/reports')
        .send({ exhibitId: EXHIBIT_ID, category: 'wrong_info', message: `Mặc định ${i}` })
        .expect(201);
      assert.equal(response.body.data.id, `report-${i}`);
    }

    await request(app.getHttpServer())
      .post('/public/reports')
      .send({ exhibitId: EXHIBIT_ID, category: 'wrong_info', message: 'Vượt mức mặc định' })
      .expect(429);
    assert.equal(created.length, 5);
  });

  it('creates the configured number of reports per client IP and creates none after the limit', async () => {
    const { app, created } = await makeApp(2);

    for (let i = 1; i <= 2; i++) {
      const response = await request(app.getHttpServer())
        .post('/public/reports')
        .send({ exhibitId: EXHIBIT_ID, category: 'wrong_info', message: `Báo cáo ${i}` })
        .expect(201);
      assert.equal(response.body.success, true);
      assert.equal(response.body.data.id, `report-${i}`);
      assert.equal(response.body.data.status, 'open');
    }

    const blocked = await request(app.getHttpServer())
      .post('/public/reports')
      .send({ exhibitId: EXHIBIT_ID, category: 'wrong_info', message: 'Vượt giới hạn' })
      .expect(429);
    assert.equal(blocked.body.success, false);
    assert.deepEqual(created, [
      { id: 'report-1', status: 'open' },
      { id: 'report-2', status: 'open' },
    ]);
  });

  it('rejects an invalid body without creating a report', async () => {
    const { app, created } = await makeApp(2);

    await request(app.getHttpServer()).post('/public/reports').send({}).expect(400);
    assert.deepEqual(created, []);
  });

  it('handles 40 concurrent client IPs with p95 at or below 1.5 seconds and 40 report creations', async () => {
    const { app, created } = await makeApp(100, true);
    const results = await Promise.all(Array.from({ length: 40 }, async (_, index) => {
      const startedAt = performance.now();
      const response = await request(app.getHttpServer())
        .post('/public/reports')
        .set('x-forwarded-for', `198.51.100.${index + 1}`)
        .send({ exhibitId: EXHIBIT_ID, category: 'wrong_info', message: `Concurrent report ${index + 1}` });
      return { status: response.status, id: response.body.data?.id, durationMs: performance.now() - startedAt };
    }));
    const sortedDurations = results.map((result) => result.durationMs).sort((a, b) => a - b);
    const p95Ms = sortedDurations[Math.ceil(sortedDurations.length * 0.95) - 1];

    assert.ok(results.every((result) => result.status === 201), 'all 40 API requests should be accepted');
    assert.equal(created.length, 40, 'the service should create 40 reports');
    assert.equal(new Set(results.map((result) => result.id)).size, 40, 'each request should create a distinct report');
    assert.ok(p95Ms <= 1500, `p95 was ${p95Ms.toFixed(1)} ms, expected <= 1500 ms`);
    console.log(`40 simulated client IPs: 40/40 reports created; p95=${p95Ms.toFixed(1)} ms`);
  });
});
