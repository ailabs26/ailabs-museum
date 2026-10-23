import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import {
  ConflictException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import { ExhibitRevisionsController } from '../controllers/exhibit-revisions.controller';
import { ModerationController } from '../controllers/moderation.controller';
import { RevisionsController } from '../controllers/revisions.controller';
import { ModerationService } from '../services/moderation.service';

const UUID = 'd1111111-1111-4111-1111-111111111111';

describe('Moderation HTTP · queue', () => {
  const apps: INestApplication[] = [];
  after(async () => { await Promise.all(apps.map(app => app.close())); });

  it('returns queue items and pagination meta without changing bilingual content', async () => {
    const app = await makeApp({ queue: async query => ({
      items: [{ id: UUID, content: { name: { vi: 'Bình gốm', en: 'Vase' } } }] as never,
      page: query.page, pageSize: query.pageSize, total: 21,
    }) });
    apps.push(app);
    const res = await request(app.getHttpServer()).get('/moderation/queue?page=2&pageSize=20').expect(200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.meta, { page: 2, pageSize: 20, total: 21 });
    assert.deepEqual(res.body.data[0].content.name, { vi: 'Bình gốm', en: 'Vase' });
  });

  it('rejects invalid page/pageSize before querying the queue', async () => {
    const app = await makeApp({ queue: async () => { throw new Error('must not be called'); } });
    apps.push(app);
    await request(app.getHttpServer()).get('/moderation/queue?page=0&pageSize=101').expect(400);
  });
});

/** Dựng app test với ResponseInterceptor + AllExceptionsFilter + ValidationPipe như main.ts. */
async function makeApp(mock: Partial<ModerationService>): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [ModerationController, RevisionsController, ExhibitRevisionsController],
    providers: [{ provide: ModerationService, useValue: mock }],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  return app;
}

describe('Moderation HTTP · publish', () => {
  const apps: INestApplication[] = [];
  after(async () => {
    await Promise.all(apps.map((a) => a.close()));
  });

  it('200 + envelope ApiResponse khi publish thành công', async () => {
    const app = await makeApp({
      publish: () => Promise.resolve({ id: UUID, state: 'approved' } as never),
    });
    apps.push(app);

    const res = await request(app.getHttpServer())
      .post(`/revisions/${UUID}/publish`)
      .send({ version: 3 })
      .expect(201);

    assert.equal(res.body.success, true);
    assert.equal(res.body.data.id, UUID);
  });

  it('409 khi version lệch (ConflictException)', async () => {
    const app = await makeApp({
      publish: () => Promise.reject(new ConflictException('Nội dung đã bị thay đổi')),
    });
    apps.push(app);

    const res = await request(app.getHttpServer())
      .post(`/revisions/${UUID}/publish`)
      .send({ version: 1 })
      .expect(409);

    assert.equal(res.body.success, false);
    assert.match(res.body.message, /thay đổi/);
  });

  it('404 khi không tìm thấy revision', async () => {
    const app = await makeApp({
      publish: () => Promise.reject(new NotFoundException('Không tìm thấy phiên bản')),
    });
    apps.push(app);

    const res = await request(app.getHttpServer())
      .post(`/revisions/${UUID}/publish`)
      .send({ version: 3 })
      .expect(404);

    assert.equal(res.body.success, false);
  });

  it('400 khi thiếu version (validation)', async () => {
    const app = await makeApp({ publish: () => Promise.resolve({} as never) });
    apps.push(app);

    const res = await request(app.getHttpServer())
      .post(`/revisions/${UUID}/publish`)
      .send({})
      .expect(400);

    assert.equal(res.body.success, false);
  });
});

describe('Moderation HTTP · reject', () => {
  const apps: INestApplication[] = [];
  after(async () => {
    await Promise.all(apps.map((a) => a.close()));
  });

  it('400 khi thiếu lý do từ chối (validation)', async () => {
    const app = await makeApp({ reject: () => Promise.resolve({} as never) });
    apps.push(app);

    const res = await request(app.getHttpServer())
      .post(`/revisions/${UUID}/reject`)
      .send({ version: 3 })
      .expect(400);

    assert.equal(res.body.success, false);
  });
});

describe('Moderation HTTP · hide', () => {
  const apps: INestApplication[] = [];
  after(async () => {
    await Promise.all(apps.map((a) => a.close()));
  });

  it('409 khi version lệch lúc tạm ẩn', async () => {
    const app = await makeApp({
      hide: () => Promise.reject(new ConflictException('Nội dung đã bị thay đổi')),
    });
    apps.push(app);

    await request(app.getHttpServer())
      .post(`/exhibits/${UUID}/hide`)
      .send({ version: 1 })
      .expect(409);
  });

  it('201 khi tạm ẩn kèm lý do hợp lệ', async () => {
    const app = await makeApp({
      hide: () => Promise.resolve({ id: UUID, visibility: 'hidden', version: 2 } as never),
    });
    apps.push(app);

    const res = await request(app.getHttpServer())
      .post(`/exhibits/${UUID}/hide`)
      .send({ version: 1, reason: 'Tạm ẩn để kiểm tra niên đại hiện vật' })
      .expect(201);

    assert.equal(res.body.success, true);
    assert.equal(res.body.data.visibility, 'hidden');
  });
});
