import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import { NotificationsController } from '../controllers/notifications.controller';
import { NotificationsService } from '../services/notifications.service';

const ME = '11111111-1111-4111-8111-111111111111';
const NOTE = '22222222-2222-4222-8222-222222222222';

describe('Notifications API (HTTP)', () => {
  let app: INestApplication;
  const calls: unknown[][] = [];

  before(async () => {
    const service = {
      list: async (...args: unknown[]) => { calls.push(['list', ...args]); return { items: [], total: 0, page: 2, pageSize: 10 }; },
      unreadCount: async (...args: unknown[]) => { calls.push(['unreadCount', ...args]); return { count: 4 }; },
      markAllRead: async (...args: unknown[]) => { calls.push(['markAllRead', ...args]); return { updated: 4 }; },
      markRead: async (...args: unknown[]) => { calls.push(['markRead', ...args]); },
      remove: async (userId: string, id: string) => {
        calls.push(['remove', userId, id]);
        if (id !== NOTE) throw new NotFoundException('Không tìm thấy thông báo');
      },
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: service }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use((req: Request & { user?: unknown }, _res: Response, next: NextFunction) => { req.user = { id: ME }; next(); });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  beforeEach(() => { calls.length = 0; });
  after(async () => { await app?.close(); });

  const http = () => request(app.getHttpServer());

  it('GET /notifications phân trang theo user hiện tại, trả meta', async () => {
    const res = await http().get('/notifications?page=2&pageSize=10').expect(200);
    assert.deepEqual(res.body.meta, { page: 2, pageSize: 10, total: 0 });
    assert.deepEqual(calls, [['list', ME, 2, 10]]);
  });

  it('GET /notifications/unread-count, POST /notifications/read-all (200)', async () => {
    assert.deepEqual((await http().get('/notifications/unread-count').expect(200)).body.data, { count: 4 });
    assert.deepEqual((await http().post('/notifications/read-all').expect(200)).body.data, { updated: 4 });
    assert.deepEqual(calls, [['unreadCount', ME], ['markAllRead', ME]]);
  });

  it('PATCH :id/read và DELETE :id dùng user hiện tại; id không phải UUID → 400; không thuộc mình → 404', async () => {
    await http().patch(`/notifications/${NOTE}/read`).expect(200);
    await http().delete(`/notifications/${NOTE}`).expect(200);
    await http().delete('/notifications/33333333-3333-4333-8333-333333333333').expect(404);
    await http().patch('/notifications/abc/read').expect(400);
    assert.deepEqual(calls.map((c) => c.slice(0, 2)), [['markRead', ME], ['remove', ME], ['remove', ME]]);
  });
});
