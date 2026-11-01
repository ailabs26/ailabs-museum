import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InternalServerErrorException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { PasswordService } from '../../../common/security/password.service';
import { RefreshSessionsRepository } from '../../auth/repositories/refresh-sessions.repository';
import { UserRolesRepository } from '../repositories/user-roles.repository';
import { UsersRepository } from '../repositories/users.repository';
import { UsersService } from '../services/users.service';

const MANAGER = {} as EntityManager;

function idFor(value: number): string {
  return `00000000-0000-4000-8000-${value.toString(16).padStart(12, '0')}`;
}

function nextRandom(state: number): number {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}

function restoreHarness(ids: string[], affected: number | Error) {
  const events: string[] = [];
  const users = {
    lockManagement: async (manager: EntityManager) => {
      assert.equal(manager, MANAGER);
      events.push('lock');
    },
    lockDeletedByIds: async (requested: string[], manager: EntityManager) => {
      assert.equal(manager, MANAGER);
      assert.deepEqual(requested, ids);
      return ids.map((id) => ({ id }));
    },
    markRestored: async (requested: string[], manager: EntityManager) => {
      assert.equal(manager, MANAGER);
      assert.deepEqual(requested, ids);
      events.push('update');
      if (affected instanceof Error) throw affected;
      return affected;
    },
  } as unknown as UsersRepository;
  const roles = {
    removeDeletedRoleLinks: async (requested: string[], manager: EntityManager) => {
      assert.equal(manager, MANAGER);
      assert.deepEqual(requested, ids);
      events.push('cleanup');
    },
  } as unknown as UserRolesRepository;
  const tx = {
    run: <T>(work: (manager: EntityManager) => Promise<T>) => work(MANAGER),
  } as TransactionManager;
  const service = new UsersService(
    users,
    roles,
    {} as PasswordService,
    tx,
    {} as RefreshSessionsRepository,
  );
  return { service, events };
}

describe('user restore affected-row contract', () => {
  it('rejects a zero-row update instead of reporting a successful restore', async () => {
    const ids = [idFor(1)];
    const { service, events } = restoreHarness(ids, 0);

    await assert.rejects(service.restoreMany(ids), InternalServerErrorException);
    assert.deepEqual(events, ['lock', 'update']);
  });

  it('property: for seeded batches of 1–100 IDs, success requires every row updated', async () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const batchSize = 1 + (nextRandom(seed) % 100);
      const ids = Array.from({ length: batchSize }, (_, index) => idFor(seed * 100 + index));
      const affected = seed % 2 === 0 ? batchSize : nextRandom(seed + 100) % batchSize;
      const { service, events } = restoreHarness(ids, affected);

      if (affected === batchSize) {
        assert.deepEqual(await service.restoreMany(ids), { ids }, `seed=${seed}`);
        assert.deepEqual(events, ['lock', 'update', 'cleanup'], `seed=${seed}`);
      } else {
        await assert.rejects(service.restoreMany(ids), InternalServerErrorException, `seed=${seed}`);
        assert.deepEqual(events, ['lock', 'update'], `seed=${seed}`);
      }
    }
  });

  it('propagates a persistence rejection and does not clean role links', async () => {
    const ids = [idFor(2)];
    const failure = new Error('database write failed');
    const { service, events } = restoreHarness(ids, failure);

    await assert.rejects(service.restoreMany(ids), (error: unknown) => error === failure);
    assert.deepEqual(events, ['lock', 'update']);
  });
});
