import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EntityManager } from 'typeorm';
import type { TransactionManager } from '../../../common/database/transaction.manager';
import type { RefreshSessionsRepository } from '../repositories/refresh-sessions.repository';
import {
  CLEANUP_BATCH_FAMILIES,
  DEAD_SESSION_RETENTION_MS,
  SessionsCleanupService,
} from '../services/sessions-cleanup.service';

const MANAGER = {} as EntityManager;
const tx = { run: <T>(work: (m: EntityManager) => Promise<T>) => work(MANAGER) } as TransactionManager;

/** Repo giả trả lần lượt số row đã xóa mỗi lô và ghi lại tham số. */
function fakeRepo(batches: number[]) {
  const calls: { cutoff: Date; limit: number; manager: EntityManager }[] = [];
  const repo = {
    deleteDeadFamilies: async (cutoff: Date, limit: number, manager: EntityManager) => {
      calls.push({ cutoff, limit, manager });
      return batches.shift() ?? 0;
    },
  } as unknown as RefreshSessionsRepository;
  return { repo, calls };
}

describe('SessionsCleanupService', () => {
  it('xóa theo lô tới khi hết, cutoff = now - 7 ngày, trong transaction', async () => {
    const { repo, calls } = fakeRepo([1200, 40, 0]);
    const now = new Date('2026-11-02T03:00:00Z');

    const total = await new SessionsCleanupService(repo, tx).purgeDeadSessions(now);

    assert.equal(total, 1240);
    assert.equal(calls.length, 3);
    for (const call of calls) {
      assert.equal(call.cutoff.getTime(), now.getTime() - DEAD_SESSION_RETENTION_MS);
      assert.equal(call.limit, CLEANUP_BATCH_FAMILIES);
      assert.equal(call.manager, MANAGER);
    }
  });

  it('không có gì để xóa → 0, gọi đúng 1 lần', async () => {
    const { repo, calls } = fakeRepo([]);
    assert.equal(await new SessionsCleanupService(repo, tx).purgeDeadSessions(), 0);
    assert.equal(calls.length, 1);
  });

  it('cron nuốt lỗi DB để không làm sập tiến trình', async () => {
    const repo = {
      deleteDeadFamilies: async () => { throw new Error('db down'); },
    } as unknown as RefreshSessionsRepository;
    await assert.doesNotReject(new SessionsCleanupService(repo, tx).handleCron());
  });
});
