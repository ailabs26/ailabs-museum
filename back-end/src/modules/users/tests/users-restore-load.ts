/**
 * VT-080 reproducible 100-operation concurrency harness. No HTTP or PostgreSQL:
 * a transaction queue models the shared management lock and the repository
 * simulates a 10 ms asynchronous write per operation.
 */
import 'reflect-metadata';
import { performance } from 'node:perf_hooks';
import type { EntityManager } from 'typeorm';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { PasswordService } from '../../../common/security/password.service';
import { RefreshSessionsRepository } from '../../auth/repositories/refresh-sessions.repository';
import { UserRolesRepository } from '../repositories/user-roles.repository';
import { UsersRepository } from '../repositories/users.repository';
import { UsersService } from '../services/users.service';

const manager = {} as EntityManager;
const delay = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
const users = {
  lockManagement: async () => undefined,
  lockDeletedByIds: async (ids: string[]) => ids.map((id) => ({ id })),
  markRestored: async () => {
    await delay(10);
    return 1;
  },
} as unknown as UsersRepository;
const roles = { removeDeletedRoleLinks: async () => undefined } as unknown as UserRolesRepository;
let transactionTail = Promise.resolve();
const tx = {
  run: async <T>(work: (scope: EntityManager) => Promise<T>): Promise<T> => {
    const previous = transactionTail;
    let release!: () => void;
    transactionTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await work(manager);
    } finally {
      release();
    }
  },
} as TransactionManager;
const service = new UsersService(users, roles, {} as PasswordService, tx, {} as RefreshSessionsRepository);

async function main(): Promise<void> {
  const operationCount = 100;
  const started = performance.now();
  const durations = await Promise.all(Array.from({ length: operationCount }, async (_, index) => {
    const id = `00000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, '0')}`;
    const operationStarted = performance.now();
    await service.restoreMany([id]);
    return performance.now() - operationStarted;
  }));
  durations.sort((a, b) => a - b);
  const p95Ms = durations[Math.ceil(operationCount * 0.95) - 1];
  process.stdout.write(`${JSON.stringify({
    kind: 'simulated-serialized-users-restore', operationCount, fakeWriteDelayMs: 10,
    p95Ms: Number(p95Ms.toFixed(2)), totalMs: Number((performance.now() - started).toFixed(2)),
    targetMs: 3000, meetsSimulatedTarget: p95Ms <= 3000,
  })}\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
