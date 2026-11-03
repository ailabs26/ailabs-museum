import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import { HealthController } from '../health.controller';
import { HealthService } from '../health.service';

/** DataSource giả: hành vi `query` đổi được theo từng test. */
const fakeDataSource = { query: async (): Promise<unknown> => [{ '?column?': 1 }] };

describe('HealthController HTTP', () => {
  let app: INestApplication;
  let service: HealthService;

  before(async () => {
    service = new HealthService(fakeDataSource as unknown as DataSource);
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: service }],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  after(async () => {
    await app?.close();
  });

  it('GET /health (liveness) không chạm DB', async () => {
    fakeDataSource.query = async () => {
      throw new Error('không được gọi');
    };
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    assert.deepEqual(res.body.data, { status: 'ok' });
  });

  it('GET /health/ready → 200 kèm độ trễ khi DB trả lời', async () => {
    let sql = '';
    fakeDataSource.query = async (...args: unknown[]) => {
      sql = String(args[0]);
      return [{ '?column?': 1 }];
    };
    const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
    assert.equal(sql, 'SELECT 1');
    assert.equal(res.body.data.status, 'ok');
    assert.equal(res.body.data.db, 'up');
    assert.ok(Number.isInteger(res.body.data.latencyMs) && res.body.data.latencyMs >= 0);
  });

  it('DB lỗi → 503, không lộ chi tiết lỗi DB', async () => {
    fakeDataSource.query = async () => {
      throw new Error('connect ECONNREFUSED 10.1.2.3:5432 password authentication failed');
    };
    const res = await request(app.getHttpServer()).get('/health/ready').expect(503);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'Cơ sở dữ liệu không sẵn sàng');
    assert.doesNotMatch(JSON.stringify(res.body), /ECONNREFUSED|10\.1\.2\.3|password/);
  });

  it('DB treo quá timeout → 503 đúng hạn', async () => {
    service.timeoutMs = 50;
    fakeDataSource.query = () => new Promise(() => undefined);
    const startedAt = Date.now();
    await request(app.getHttpServer()).get('/health/ready').expect(503);
    assert.ok(Date.now() - startedAt < 1000);
    service.timeoutMs = 2000;
  });
});

/**
 * Chỉ chạy khi CORE_TEST_DATABASE_URL trỏ tới database cục bộ (localhost) — không bao giờ chạy
 * trên DB dùng chung.
 */
const TEST_DATABASE_URL = process.env.CORE_TEST_DATABASE_URL;
const isLocalDatabase = !!TEST_DATABASE_URL && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(TEST_DATABASE_URL);
const skip = isLocalDatabase ? false : 'Cần CORE_TEST_DATABASE_URL trỏ tới PostgreSQL cục bộ';

describe('HealthService với PostgreSQL thật', { skip }, () => {
  let db: DataSource;

  before(async () => {
    db = await new DataSource({ type: 'postgres', url: TEST_DATABASE_URL }).initialize();
  });

  after(async () => {
    if (db?.isInitialized) await db.destroy();
  });

  it('ping thành công khi DB chạy, ném lỗi sau khi mất kết nối', async () => {
    const service = new HealthService(db);
    assert.ok((await service.pingDatabase()) >= 0);
    await db.destroy();
    await assert.rejects(() => service.pingDatabase());
  });
});
