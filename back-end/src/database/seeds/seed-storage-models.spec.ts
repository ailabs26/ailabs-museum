import 'reflect-metadata';
import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { DataSource, EntityManager } from 'typeorm';
import { Exhibit } from '../../modules/exhibits/entities/exhibit.entity';
import { ExhibitRevision } from '../../modules/exhibits/entities/exhibit-revision.entity';
import { Media } from '../../modules/media/entities/media.entity';
import { Room } from '../../modules/rooms/entities/room.entity';
import { User } from '../../modules/users/entities/user.entity';
import { STORAGE_MODELS, STORAGE_MODEL_ROOM } from './storage-model-content';
import { seedStorageModels } from './seed-storage-models';

function database() {
  const tables = new Map<unknown, Map<string, Record<string, unknown>>>();
  for (const entity of [Room, Exhibit, ExhibitRevision, Media]) tables.set(entity, new Map());
  let admin = true;
  const manager = {
    query: async () => [],
    findOne: async (entity: unknown, options: { where: Record<string, unknown> | Record<string, unknown>[] }) => {
      if (entity === User) return admin ? { id: 'admin' } : null;
      const alternatives = Array.isArray(options.where) ? options.where : [options.where];
      return [...tables.get(entity)!.values()].find(value => alternatives.some(where => Object.entries(where).every(([key, expected]) => value[key] === expected))) ?? null;
    },
    count: async () => 1,
    create: (_entity: unknown, value: unknown) => value,
    save: async (entity: unknown, value: Record<string, unknown>) => { tables.get(entity)!.set(value.id as string, value); return value; },
    update: async (entity: unknown, id: string, patch: Record<string, unknown>) => Object.assign(tables.get(entity)!.get(id)!, patch),
  } as unknown as EntityManager;
  const source = { transaction: async (work: (manager: EntityManager) => Promise<unknown>) => {
    const before = [...tables].map(([entity, rows]) => [entity, structuredClone(rows)] as const);
    try { return await work(manager); }
    catch (error) { tables.clear(); before.forEach(([entity, rows]) => tables.set(entity, rows)); throw error; }
  } } as unknown as DataSource;
  return { source, tables, denyAdmin: () => { admin = false; } };
}

it('adds five distinct media/exhibit/revision mappings and preserves edits on rerun', async () => {
  const db = database();
  assert.deepEqual(await seedStorageModels(db.source, 'admin'), { created: 5, skipped: 0 });
  assert.equal(db.tables.get(Room)!.size, 1);
  for (const model of STORAGE_MODELS) {
    assert.equal(db.tables.get(Exhibit)!.get(model.exhibitId)!.publishedRevisionId, model.revisionId);
    assert.equal(db.tables.get(ExhibitRevision)!.get(model.revisionId)!.modelMediaId, model.mediaId);
    assert.equal(db.tables.get(Media)!.get(model.mediaId)!.checksumSha256, model.checksum);
  }
  db.tables.get(Exhibit)!.get(STORAGE_MODELS[0].exhibitId)!.visibility = 'hidden';
  assert.deepEqual(await seedStorageModels(db.source, 'admin'), { created: 0, skipped: 5 });
  assert.equal(db.tables.get(Exhibit)!.get(STORAGE_MODELS[0].exhibitId)!.visibility, 'hidden');
});

it('rolls back all new content on a path collision and refuses a missing admin', async () => {
  const db = database();
  const model = STORAGE_MODELS[4];
  db.tables.get(Media)!.set('other', { id: 'other', storageKey: model.key });
  await assert.rejects(() => seedStorageModels(db.source, 'admin'), /Mapping/);
  assert.equal(db.tables.get(Room)!.size, 0);
  assert.equal(db.tables.get(Exhibit)!.size, 0);
  assert.equal(db.tables.get(Media)!.size, 1);
  db.denyAdmin();
  await assert.rejects(() => seedStorageModels(db.source, 'admin'), /admin/);
  assert.equal(db.tables.get(Room)!.has(STORAGE_MODEL_ROOM.id), false);
});
