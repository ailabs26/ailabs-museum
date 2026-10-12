import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { AuditMeta } from '../decorators/audit.decorator';
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
});
