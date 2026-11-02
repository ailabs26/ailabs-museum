import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import { csvCell, toAuditCsv } from '../audit-csv.util';
import { AuditController } from '../controllers/audit.controller';
import { toAuditLogResponse } from '../dto/audit-log-response.dto';
import type { AuditLog } from '../entities/audit-log.entity';
import type { AuditFilter, AuditRepository } from '../repositories/audit.repository';
import { AUDIT_EXPORT_MAX_ROWS, AuditService } from '../services/audit.service';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT = { ip: '10.0.0.1', userAgent: 'UA', requestId: 'req-1' };

function log(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', actorId: ADMIN_ID,
    actor: { id: ADMIN_ID, email: 'admin@aura.local', displayName: 'Quản trị viên' },
    action: 'user.create', resourceType: 'user', resourceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', revisionId: null,
    reason: null, requestId: 'r-1', ip: '1.2.3.4', userAgent: 'Firefox', occurredAt: new Date('2026-11-02T03:04:05.000Z'),
    ...overrides,
  } as AuditLog;
}

/** Repo giả: trả `count` bản ghi (tối đa `limit`), ghi lại bộ lọc và bản ghi audit đã lưu. */
function harness(count: number) {
  const calls: { filter: AuditFilter; limit: number }[] = [];
  const saved: Partial<AuditLog>[] = [];
  const repo = {
    listForExport: async (filter: AuditFilter, limit: number) => {
      calls.push({ filter, limit });
      return Array.from({ length: Math.min(count, limit) }, () => log());
    },
    create: (data: Partial<AuditLog>) => data,
    save: async (data: Partial<AuditLog>) => { saved.push(data); return data; },
  } as unknown as AuditRepository;
  return { service: new AuditService(repo), calls, saved };
}

describe('CSV nhật ký', () => {
  it('csvCell: bọc nháy, nhân đôi nháy, null → ô rỗng; giữ dấu phẩy và xuống dòng trong ô', () => {
    assert.equal(csvCell('a"b'), '"a""b"');
    assert.equal(csvCell(null), '""');
    assert.equal(csvCell('x,y\nz'), '"x,y\nz"');
  });

  it('csvCell: ô bắt đầu = + - @ tab CR bị vô hiệu công thức bằng tiền tố \'', () => {
    for (const evil of ['=HYPERLINK("http://x")', '+1', '-2+3', '@SUM(A1)', '\tcmd', '\rcmd']) {
      assert.equal(csvCell(evil).startsWith(`"'`), true, evil);
    }
    assert.equal(csvCell('a=b'), '"a=b"');
  });

  it('toAuditCsv: BOM UTF-8, tiêu đề tiếng Việt, CRLF, thời điểm ISO UTC, actor null → ô rỗng', () => {
    const csv = toAuditCsv([toAuditLogResponse(log()), toAuditLogResponse(log({ actor: null, actorId: null, action: 'auth.login_failed' }))]);
    assert.equal(csv.charCodeAt(0), 0xfeff);
    const lines = csv.slice(1).split('\r\n');
    assert.equal(lines.length, 4); // tiêu đề + 2 dòng + dòng trống cuối
    assert.match(lines[0], /^"Thời điểm \(UTC\)","Hành động",/);
    assert.match(lines[1], /^"2026-11-02T03:04:05.000Z","user.create","user",".+","admin@aura.local","Quản trị viên",/);
    assert.match(lines[2], /^"2026-11-02T03:04:05.000Z","auth.login_failed","user",".+","","",""/);
    assert.equal(lines[3], '');
  });
});

describe('AuditService.exportCsv', () => {
  it('chuyển bộ lọc (from/to → Date), lấy tối đa MAX+1 dòng, ghi audit.export kèm bộ lọc + số dòng + client', async () => {
    const { service, calls, saved } = harness(3);
    const csv = await service.exportCsv({ action: 'user.create', from: '2026-11-01T00:00:00.000Z' }, ADMIN_ID, CLIENT);

    assert.equal(csv.slice(1).split('\r\n').length, 5);
    assert.equal(calls[0].limit, AUDIT_EXPORT_MAX_ROWS + 1);
    assert.equal(calls[0].filter.action, 'user.create');
    assert.equal(calls[0].filter.from?.toISOString(), '2026-11-01T00:00:00.000Z');
    assert.equal(calls[0].filter.to, undefined);
    assert.deepEqual(saved.map((e) => [e.action, e.actorId, e.resourceType, e.resourceId, e.ip, e.userAgent, e.requestId]), [
      ['audit.export', ADMIN_ID, 'audit', null, '10.0.0.1', 'UA', 'req-1'],
    ]);
    assert.deepEqual(JSON.parse(saved[0].reason!), { filter: { action: 'user.create', from: '2026-11-01T00:00:00.000Z' }, rows: 3 });
  });

  it('đúng MAX dòng → xuất được; hơn MAX → 400, không ghi audit.export', async () => {
    const ok = harness(AUDIT_EXPORT_MAX_ROWS);
    await assert.doesNotReject(ok.service.exportCsv({}, ADMIN_ID, CLIENT));

    const tooMany = harness(AUDIT_EXPORT_MAX_ROWS + 5);
    await assert.rejects(tooMany.service.exportCsv({}, ADMIN_ID, CLIENT), BadRequestException);
    assert.deepEqual(tooMany.saved, []);
  });
});

describe('GET /audit/export (HTTP)', () => {
  let app: INestApplication;
  const exportCalls: unknown[][] = [];

  before(async () => {
    const service = {
      exportCsv: async (...args: unknown[]) => { exportCalls.push(args); return '﻿"a"\r\n'; },
      getById: async () => ({ id: 'x' }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [{ provide: AuditService, useValue: service }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use((req: Request & { user?: unknown }, _res: Response, next: NextFunction) => {
      req.user = { id: ADMIN_ID };
      next();
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  beforeEach(() => { exportCalls.length = 0; });

  after(async () => { await app?.close(); });

  it('trả file CSV tải về (không bọc ApiResponse), không cache; truyền bộ lọc + actor + client', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit/export?action=user.create&resourceType=user')
      .set('User-Agent', 'UA').set('X-Request-Id', 'req-9')
      .buffer(true).parse((r, cb) => { let body = ''; r.setEncoding('utf8'); r.on('data', (c: string) => { body += c; }); r.on('end', () => cb(null, body)); })
      .expect(200);

    assert.equal(res.headers['content-type'], 'text/csv; charset=utf-8');
    assert.match(res.headers['content-disposition'], /^attachment; filename="audit-logs-\d{8}-\d{4}\.csv"$/);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.body, '﻿"a"\r\n');
    const [query, actorId, client] = exportCalls[0] as [Record<string, unknown>, string, Record<string, unknown>];
    assert.deepEqual({ ...query }, { action: 'user.create', resourceType: 'user' });
    assert.equal(actorId, ADMIN_ID);
    assert.equal(client.userAgent, 'UA');
    assert.equal(client.requestId, 'req-9');
  });

  it('từ chối tham số phân trang và bộ lọc sai định dạng (400), không gọi service', async () => {
    await request(app.getHttpServer()).get('/audit/export?page=2').expect(400);
    await request(app.getHttpServer()).get('/audit/export?from=hom-qua').expect(400);
    await request(app.getHttpServer()).get('/audit/export?actorId=khong-phai-uuid').expect(400);
    assert.equal(exportCalls.length, 0);
  });
});
