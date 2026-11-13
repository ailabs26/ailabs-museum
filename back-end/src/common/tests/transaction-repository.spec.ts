import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { TransactionManager } from '../database/transaction.manager';
import { BaseRepository } from '../repository/base.repository';

interface Thing {
  id: string;
  name: string;
}

class ThingRepository extends BaseRepository<Thing> {
  constructor(repo: Repository<Thing>) {
    super(repo);
  }
}

/** Repository<Thing> giả: ghi lại (tên repo, method, đối số) cho từng lời gọi. */
function fakeRepo(label: string, calls: unknown[][], results: Record<string, unknown> = {}): Repository<Thing> {
  const target = { name: 'Thing' };
  return new Proxy({ target } as object, {
    get: (object, prop) => {
      if (prop === 'target') return target;
      if (typeof prop !== 'string' || prop === 'then') return undefined;
      return (...args: unknown[]) => {
        calls.push([label, prop, ...args]);
        if (prop in results) return results[prop];
        return prop === 'create' ? args[0] : Promise.resolve(undefined);
      };
    },
  }) as Repository<Thing>;
}

describe('TransactionManager', () => {
  it('ủy quyền cho DataSource.transaction và trả về kết quả của work', async () => {
    const manager = { tag: 'tx-manager' } as unknown as EntityManager;
    let invoked = 0;
    const dataSource = {
      transaction: (work: (m: EntityManager) => Promise<unknown>) => {
        invoked += 1;
        return work(manager);
      },
    } as unknown as DataSource;

    const result = await new TransactionManager(dataSource).run(async (received) => {
      assert.equal(received, manager);
      return 42;
    });
    assert.equal(result, 42);
    assert.equal(invoked, 1);
  });

  it('lan truyền lỗi của work để DataSource rollback', async () => {
    let rolledBack = false;
    const dataSource = {
      transaction: async (work: (m: EntityManager) => Promise<unknown>) => {
        try {
          return await work({} as EntityManager);
        } catch (error) {
          rolledBack = true;
          throw error;
        }
      },
    } as unknown as DataSource;

    await assert.rejects(
      new TransactionManager(dataSource).run(async () => {
        throw new Error('boom');
      }),
      /boom/,
    );
    assert.equal(rolledBack, true);
  });
});

describe('BaseRepository', () => {
  it('findById / findOne / findMany truyền đúng điều kiện', async () => {
    const calls: unknown[][] = [];
    const repo = new ThingRepository(fakeRepo('base', calls));
    await repo.findById('t1');
    await repo.findById('t2', ['owner']);
    await repo.findOne({ name: 'a' }, { order: { name: 'ASC' } });
    await repo.findOne({ name: 'b' });
    await repo.findMany({ take: 3 });
    await repo.findMany();
    assert.deepEqual(calls, [
      ['base', 'findOne', { where: { id: 't1' }, relations: [] }],
      ['base', 'findOne', { where: { id: 't2' }, relations: ['owner'] }],
      ['base', 'findOne', { where: { name: 'a' }, order: { name: 'ASC' } }],
      ['base', 'findOne', { where: { name: 'b' } }],
      ['base', 'find', { take: 3 }],
      ['base', 'find', {}],
    ]);
  });

  it('paginate tính skip/take và kẹp page/pageSize tối thiểu 1', async () => {
    const calls: unknown[][] = [];
    const repo = new ThingRepository(fakeRepo('base', calls, {
      findAndCount: Promise.resolve([[{ id: 'x', name: 'x' }], 11]),
    }));

    const page3 = await repo.paginate({ page: 3, pageSize: 5, where: { name: 'x' } });
    assert.deepEqual(page3, { items: [{ id: 'x', name: 'x' }], total: 11, page: 3, pageSize: 5 });
    assert.equal((calls[0][2] as { skip: number }).skip, 10);
    assert.equal((calls[0][2] as { take: number }).take, 5);

    const clamped = await repo.paginate({ page: 0, pageSize: -4 });
    assert.equal(clamped.page, 1);
    assert.equal(clamped.pageSize, 1);
    assert.equal((calls[1][2] as { skip: number }).skip, 0);
  });

  it('exists / count dựa trên count()', async () => {
    const calls: unknown[][] = [];
    let next = 0;
    const repo = new ThingRepository(fakeRepo('base', calls, {
      get count() {
        return Promise.resolve(next);
      },
    }));
    next = 0;
    assert.equal(await repo.exists({ name: 'none' }), false);
    next = 2;
    assert.equal(await repo.exists({ name: 'some' }), true);
    assert.equal(await repo.count(), 2);
    assert.equal(await repo.count({ name: 'some' }), 2);
    assert.deepEqual(calls.map((call) => call[2]), [
      { where: { name: 'none' } },
      { where: { name: 'some' } },
      {},
      { where: { name: 'some' } },
    ]);
  });

  it('create không chạm transaction', () => {
    const calls: unknown[][] = [];
    const repo = new ThingRepository(fakeRepo('base', calls));
    assert.deepEqual(repo.create({ name: 'n' }), { name: 'n' });
    assert.deepEqual(calls, [['base', 'create', { name: 'n' }]]);
  });

  it('thao tác ghi dùng repo mặc định khi không có manager', async () => {
    const calls: unknown[][] = [];
    const repo = new ThingRepository(fakeRepo('base', calls));
    const thing = { id: 't', name: 'n' };
    await repo.save(thing);
    await repo.save([thing]);
    await repo.update('t', { name: 'm' });
    await repo.softDelete('t');
    await repo.remove(thing);
    assert.deepEqual(calls.map((call) => `${call[0]}.${call[1]}`), [
      'base.save', 'base.save', 'base.update', 'base.softDelete', 'base.remove',
    ]);
  });

  it('thao tác ghi đi qua EntityManager của transaction khi được truyền', async () => {
    const calls: unknown[][] = [];
    const base = fakeRepo('base', calls);
    const scopedTargets: unknown[] = [];
    const manager = {
      getRepository: (target: unknown) => {
        scopedTargets.push(target);
        return fakeRepo('tx', calls);
      },
    } as unknown as EntityManager;
    const repo = new ThingRepository(base);
    const thing = { id: 't', name: 'n' };

    await repo.save(thing, manager);
    await repo.save([thing], manager);
    await repo.update('t', { name: 'm' }, manager);
    await repo.softDelete('t', manager);
    await repo.remove(thing, manager);

    assert.deepEqual(calls.map((call) => `${call[0]}.${call[1]}`), [
      'tx.save', 'tx.save', 'tx.update', 'tx.softDelete', 'tx.remove',
    ]);
    assert.equal(scopedTargets.length, 5);
    assert.ok(scopedTargets.every((target) => target === base.target));
  });
});
