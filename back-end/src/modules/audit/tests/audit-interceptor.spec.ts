import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CallHandler, Controller, ExecutionContext, INestApplication, Post } from '@nestjs/common';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { lastValueFrom, of } from 'rxjs';
import request from 'supertest';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import { Audit, AuditMeta } from '../decorators/audit.decorator';
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { AuditService, RecordAuditInput } from '../services/audit.service';

function buildContext(id: string): ExecutionContext {
  const request = {
    user: { id: 'actor-1' },
    params: { id },
    headers: { 'x-request-id': 'req-1' },
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function fakeReflector(meta: AuditMeta): Reflector {
  return { getAllAndOverride: () => meta } as unknown as Reflector;
}

async function run(meta: AuditMeta, returnedId: string): Promise<RecordAuditInput> {
  let captured: RecordAuditInput | undefined;
  const audit = {
    record: (input: RecordAuditInput) => {
      captured = input;
      return Promise.resolve();
    },
  } as unknown as AuditService;

  const interceptor = new AuditInterceptor(fakeReflector(meta), audit);
  const next: CallHandler = { handle: () => of({ id: returnedId }) };
  await lastValueFrom(interceptor.intercept(buildContext(returnedId), next));
  assert.ok(captured, 'audit.record phải được gọi');
  return captured;
}

describe('AuditInterceptor', () => {
  it('ghi revisionId = resourceId cho hành động trên revision', async () => {
    const input = await run({ action: 'revision.publish', resourceType: 'revision' }, 'rev-9');
    assert.equal(input.resourceId, 'rev-9');
    assert.equal(input.revisionId, 'rev-9');
    assert.equal(input.action, 'revision.publish');
  });

  it('revisionId = null cho hành động không phải revision', async () => {
    const input = await run({ action: 'exhibit.hide', resourceType: 'exhibit' }, 'ex-3');
    assert.equal(input.resourceId, 'ex-3');
    assert.equal(input.revisionId, null);
  });

  it('đọc id bên trong envelope ApiResponse khi route không có param :id', async () => {
    const recorded: RecordAuditInput[] = [];
    const audit = { record: async (input: RecordAuditInput) => void recorded.push(input) } as unknown as AuditService;
    const interceptor = new AuditInterceptor(fakeReflector({ action: 'room.create', resourceType: 'room' }), audit);
    const context = buildContext('');
    (context.switchToHttp().getRequest() as { params: object }).params = {};
    const next: CallHandler = { handle: () => of({ success: true, data: { id: 'room-7' }, message: null }) };
    await lastValueFrom(interceptor.intercept(context, next));
    assert.deepEqual(recorded.map((entry) => entry.resourceId), ['room-7']);
  });
});

/**
 * Chạy cùng thứ tự đăng ký như production: AuditInterceptor qua APP_INTERCEPTOR và
 * ResponseInterceptor qua app.useGlobalInterceptors (main.ts). Nest đặt APP_INTERCEPTOR
 * ở lớp ngoài, nên AuditInterceptor nhận kết quả ĐÃ bọc envelope.
 */
describe('AuditInterceptor trong chuỗi interceptor thật', () => {
  @Controller('things')
  class ThingsController {
    @Post()
    @Audit('thing.create', 'thing')
    create() {
      return { id: 'thing-1', name: 'mới' };
    }

    @Post(':id/roles')
    @Audit('thing.assign', 'thing')
    assign() {
      return { roleIds: ['role-1', 'role-2'] };
    }
  }

  async function startApp(recorded: RecordAuditInput[]): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({
      controllers: [ThingsController],
      providers: [
        { provide: AuditService, useValue: { record: async (input: RecordAuditInput) => void recorded.push(input) } },
        { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
    return app;
  }

  it('route tạo mới (POST không có :id) vẫn ghi audit với id vừa tạo', async () => {
    const recorded: RecordAuditInput[] = [];
    const app = await startApp(recorded);
    try {
      const res = await request(app.getHttpServer()).post('/things').expect(201);
      assert.equal(res.body.data.id, 'thing-1');
      assert.deepEqual(recorded.map((entry) => [entry.action, entry.resourceId]), [['thing.create', 'thing-1']]);
    } finally {
      await app.close();
    }
  });

  it('danh sách roleIds bên trong envelope được ghi từng dòng', async () => {
    const recorded: RecordAuditInput[] = [];
    const app = await startApp(recorded);
    try {
      await request(app.getHttpServer()).post('/things/thing-1/roles').expect(201);
      assert.deepEqual(recorded.map((entry) => entry.resourceId), ['role-1', 'role-2']);
    } finally {
      await app.close();
    }
  });
});
