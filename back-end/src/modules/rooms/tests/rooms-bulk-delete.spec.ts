import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException } from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';
import type { TransactionManager } from '../../../common/database/transaction.manager';
import { Room } from '../entities/room.entity';
import { RoomsRepository } from '../repositories/rooms.repository';
import { RoomsService } from '../services/rooms.service';

const MANAGER = { tag: 'tx' } as unknown as EntityManager;

function harness(rooms: Array<{ id: string; name: string }>, liveExhibits: Record<string, number> = {}) {
  const log: string[] = [];
  let inTx = false;
  const inTransaction = (manager: EntityManager) => assert.ok(inTx && manager === MANAGER, 'phải chạy trong transaction');
  const repo = {
    lockActiveByIds: async (ids: string[], manager: EntityManager) => {
      inTransaction(manager);
      log.push(`lock:${ids.join(',')}`);
      return rooms.filter((room) => ids.includes(room.id)) as Room[];
    },
    countLiveExhibits: async (_ids: string[], manager: EntityManager) => {
      inTransaction(manager);
      return new Map(Object.entries(liveExhibits));
    },
    markDeleted: async (ids: string[], manager: EntityManager) => {
      inTransaction(manager);
      log.push(`markDeleted:${ids.join(',')}`);
    },
  } as unknown as RoomsRepository;
  const tx = {
    run: async <T>(work: (manager: EntityManager) => Promise<T>) => {
      inTx = true;
      try {
        return await work(MANAGER);
      } finally {
        inTx = false;
      }
    },
  } as unknown as TransactionManager;
  return { service: new RoomsService(repo, tx), log };
}

describe('RoomsService.removeMany — xóa mềm hàng loạt (tất cả hoặc không)', () => {
  it('mọi phòng trống → khóa rồi xóa mềm tất cả trong một transaction, trả { ids } cho audit', async () => {
    const { service, log } = harness([{ id: 'r1', name: 'A' }, { id: 'r2', name: 'B' }]);
    assert.deepEqual(await service.removeMany(['r1', 'r2']), { ids: ['r1', 'r2'] });
    assert.deepEqual(log, ['lock:r1,r2', 'markDeleted:r1,r2']);
  });

  it('1 phòng còn hiện vật hoặc không tồn tại → 409 liệt kê từng ID kèm lý do, không phòng nào bị xóa', async () => {
    const { service, log } = harness([{ id: 'r1', name: 'A' }, { id: 'r2', name: 'Phòng Gốm' }], { r2: 3 });
    await assert.rejects(service.removeMany(['r1', 'r2', 'ghost']), (error: unknown) => {
      assert.ok(error instanceof ConflictException);
      const body = error.getResponse() as { errors: Array<{ field: string; message: string }> };
      assert.deepEqual(body.errors.map((e) => e.field), ['r2', 'ghost']);
      assert.match(body.errors[0].message, /Phòng "Phòng Gốm" đang chứa 3 hiện vật/);
      return true;
    });
    assert.equal(log.some((entry) => entry.startsWith('markDeleted')), false);
  });
});

describe('RoomsRepository — hiện vật đã xóa mềm không còn tính vào phòng', () => {
  const room = () => ({
    id: 'r1', name: 'A', isDeleted: false,
    exhibits: [{ id: 'e1', isDeleted: false }, { id: 'e2', isDeleted: true }],
  }) as unknown as Room;

  it('findWithExhibits / findDetailById / findPublicRooms bỏ hiện vật đã xóa mềm khỏi quan hệ', async () => {
    const repository = new RoomsRepository({
      findOne: async () => room(),
      find: async () => [room()],
    } as unknown as Repository<Room>);
    assert.deepEqual((await repository.findWithExhibits('r1'))!.exhibits.map((e) => e.id), ['e1']);
    assert.deepEqual((await repository.findDetailById('r1'))!.exhibits.map((e) => e.id), ['e1']);
    assert.deepEqual((await repository.findPublicRooms())[0].exhibits.map((e) => e.id), ['e1']);
    assert.equal(await new RoomsRepository({ findOne: async () => null } as unknown as Repository<Room>).findWithExhibits('x'), null);
  });

  it('xóa lẻ: phòng chỉ còn hiện vật đã xóa mềm thì xóa được (không kẹt BR-20)', async () => {
    const saved: Room[] = [];
    const repository = new RoomsRepository({
      findOne: async () => ({ ...room(), exhibits: [{ id: 'e2', isDeleted: true }] }),
      save: async (entity: Room) => void saved.push(entity),
    } as unknown as Repository<Room>);
    await new RoomsService(repository, {} as TransactionManager).remove('r1');
    assert.equal(saved[0].isDeleted, true);
  });
});
