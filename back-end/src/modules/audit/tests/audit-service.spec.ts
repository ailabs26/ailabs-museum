import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toAuditLogResponse } from '../dto/audit-log-response.dto';
import type { AuditLog } from '../entities/audit-log.entity';
import type { AuditRepository } from '../repositories/audit.repository';
import { AuditService } from '../services/audit.service';

function harness(failSave = false) {
  const saved: Partial<AuditLog>[] = [];
  const repo = {
    create: (data: Partial<AuditLog>) => data,
    save: async (data: Partial<AuditLog>) => {
      if (failSave) throw new Error('db down');
      saved.push(data);
      return data;
    },
  } as unknown as AuditRepository;
  return { service: new AuditService(repo), saved };
}

describe('AuditService', () => {
  it('record lưu IP/User-Agent (cắt theo độ dài cột) và cho phép resourceId null', async () => {
    const { service, saved } = harness();
    await service.record({
      actorId: null, action: 'auth.login_failed', resourceType: 'user', resourceId: null,
      requestId: 'r', ip: '1'.repeat(80), userAgent: 'u'.repeat(600),
    });
    assert.equal(saved[0].resourceId, null);
    assert.equal(saved[0].ip?.length, 64);
    assert.equal(saved[0].userAgent?.length, 512);
  });

  it('recordSafely nuốt lỗi lưu (không làm hỏng thao tác chính)', async () => {
    const { service } = harness(true);
    await assert.doesNotReject(service.recordSafely({ actorId: null, action: 'auth.login', resourceType: 'user', resourceId: null, requestId: 'r' }));
  });

  it('access.denied không còn dùng UUID giả: resourceId null, kèm IP/User-Agent', async () => {
    const { service, saved } = harness();
    await service.recordAccessDenied({
      actorId: null, method: 'GET', route: '/users', requiredPermissions: ['user:read'], missingPermissions: ['user:read'],
      requestId: 'r', ip: '10.0.0.1', userAgent: 'UA',
    });
    assert.equal(saved[0].resourceId, null);
    assert.equal(saved[0].ip, '10.0.0.1');
    assert.equal(saved[0].userAgent, 'UA');
  });

  it('response audit chỉ lộ id/email/tên của actor — không passwordHash, trạng thái hay cờ xóa', () => {
    const log = {
      id: 'a1', actorId: 'u1', action: 'user.create', resourceType: 'user', resourceId: 'x', revisionId: null,
      reason: null, requestId: 'r', ip: '1.1.1.1', userAgent: 'UA', occurredAt: new Date(0),
      actor: { id: 'u1', email: 'a@b.c', displayName: 'A', passwordHash: '$2a$secret', status: 'active', isDeleted: false },
    } as unknown as AuditLog;
    const response = toAuditLogResponse(log);
    assert.deepEqual(response.actor, { id: 'u1', email: 'a@b.c', displayName: 'A' });
    assert.equal(JSON.stringify(response).includes('passwordHash'), false);
    assert.equal(response.ip, '1.1.1.1');
  });
});
