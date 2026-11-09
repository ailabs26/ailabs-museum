import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';
import { ResponseInterceptor } from '../interceptors/response.interceptor';
import { PUBLIC_RATE_WINDOW_MS, PublicRateLimiter } from '../rate-limit/public-rate-limiter';
import { ExhibitsController } from '../../modules/exhibits/controllers/exhibits.controller';
import { ExhibitsService } from '../../modules/exhibits/services/exhibits.service';
import { PublicModelsService } from '../../modules/exhibits/services/public-models.service';

function limiterWith(api: number, media: number): PublicRateLimiter {
  const limiter = new PublicRateLimiter();
  limiter.limits.api = api;
  limiter.limits.media = media;
  return limiter;
}

describe('PublicRateLimiter', () => {
  it('mặc định rộng cho khách chung IP: api 600, media 3000 mỗi phút', () => {
    assert.deepEqual(new PublicRateLimiter().limits, { api: 600, media: 3000 });
  });

  it('chặn khi đủ ngưỡng trong cửa sổ, mở lại khi sang cửa sổ mới', () => {
    const limiter = limiterWith(2, 10);
    let now = 1_000_000;
    limiter.now = () => now;
    assert.equal(limiter.consume('api', '1.1.1.1').remaining, 1);
    assert.equal(limiter.consume('api', '1.1.1.1').remaining, 0);
    now += 15_000;
    const blocked = limiter.consume('api', '1.1.1.1');
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.retryAfter, 45);
    now += PUBLIC_RATE_WINDOW_MS - 15_000;
    assert.equal(limiter.consume('api', '1.1.1.1').allowed, true);
  });

  it('đếm riêng theo IP và theo nhóm api/media', () => {
    const limiter = limiterWith(1, 1);
    assert.equal(limiter.consume('api', '1.1.1.1').allowed, true);
    assert.equal(limiter.consume('api', '2.2.2.2').allowed, true);
    assert.equal(limiter.consume('media', '1.1.1.1').allowed, true);
    assert.equal(limiter.consume('api', '1.1.1.1').allowed, false);
  });

  it('dọn cửa sổ hết hạn khi số IP vượt 10.000', () => {
    const limiter = limiterWith(5, 5);
    let now = 0;
    limiter.now = () => now;
    for (let i = 0; i < 10_000; i += 1) limiter.consume('api', `ip-${i}`);
    now = PUBLIC_RATE_WINDOW_MS;
    limiter.consume('api', 'new-ip');
    const size = (limiter as unknown as { windows: Map<string, unknown> }).windows.size;
    assert.equal(size, 1);
  });
});

describe('PublicRateLimitGuard trên API công khai (HTTP)', () => {
  const apps: INestApplication[] = [];
  after(async () => { await Promise.all(apps.map((app) => app.close())); });

  async function makeApp(limiter?: PublicRateLimiter) {
    const moduleRef = await Test.createTestingModule({
      controllers: [ExhibitsController],
      providers: [
        { provide: ExhibitsService, useValue: { roomsList: () => Promise.resolve([]) } },
        { provide: PublicModelsService, useValue: { open: () => Promise.reject(new NotFoundException()) } },
        ...(limiter ? [{ provide: PublicRateLimiter, useValue: limiter }] : []),
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    apps.push(app);
    return app.getHttpServer();
  }

  it('vượt ngưỡng trả 429 kèm Retry-After và header giới hạn', async () => {
    const server = await makeApp(limiterWith(2, 100));
    const first = await request(server).get('/rooms').expect(200);
    assert.equal(first.headers['x-ratelimit-limit'], '2');
    assert.equal(first.headers['x-ratelimit-remaining'], '1');
    await request(server).get('/rooms').expect(200);
    const blocked = await request(server).get('/rooms').expect(429);
    assert.ok(Number(blocked.headers['retry-after']) >= 1);
    assert.equal(blocked.body.success, false);
  });

  it('tải mô hình GLB tính vào nhóm media, không ăn vào ngưỡng api', async () => {
    const server = await makeApp(limiterWith(1, 100));
    const model = await request(server).get('/rooms/phong-a/exhibits/x/model').expect(404);
    assert.equal(model.headers['x-ratelimit-limit'], '100');
    await request(server).get('/rooms').expect(200);
  });

  it('không có PublicRateLimiter trong DI (test dựng controller riêng) thì không giới hạn', async () => {
    const server = await makeApp();
    for (let i = 0; i < 5; i += 1) await request(server).get('/rooms').expect(200);
  });
});
