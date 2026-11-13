import 'reflect-metadata';
import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { DataSource, EntityManager } from 'typeorm';
import { Exhibit, ExhibitVisibility } from '../../modules/exhibits/entities/exhibit.entity';
import { ExhibitRevision, RevisionState } from '../../modules/exhibits/entities/exhibit-revision.entity';
import { Room, RoomStatus } from '../../modules/rooms/entities/room.entity';
import { User, UserStatus } from '../../modules/users/entities/user.entity';
import { UserRole } from '../../modules/users/entities/user-role.entity';
import { DEMO_EXHIBITS, DEMO_ROOM_SLUG } from './demo-content';
import { runDemoContentSeed, seedDemoContent } from './seed-demo-content';

function database() {
  const room = { id: 'room-id', slug: DEMO_ROOM_SLUG, status: RoomStatus.ACTIVE, isDeleted: false };
  const admin = { id: 'admin-id', status: UserStatus.ACTIVE, isDeleted: false };
  const exhibits = new Map<string, Exhibit>();
  const revisions = new Map<string, ExhibitRevision>();
  let hasAdminRole = true;
  let failSave = false;
  let destroyed = false;
  let initialized = false;
  let roomLocked = false;
  const manager = {
    findOne: async (entity: unknown, options: { where: { id?: string }; lock?: { mode: string } }) => {
      if (entity === Room) {
        roomLocked = options.lock?.mode === 'pessimistic_write';
        return room.status === RoomStatus.ACTIVE && !room.isDeleted ? room : null;
      }
      if (entity === User) return admin.status === UserStatus.ACTIVE && !admin.isDeleted ? admin : null;
      if (entity === Exhibit) return exhibits.get(options.where.id!) ?? null;
      if (entity === ExhibitRevision) return revisions.get(options.where.id!) ?? null;
      throw new Error('Unexpected entity');
    },
    count: async (entity: unknown) => {
      assert.equal(entity, UserRole);
      return hasAdminRole ? 1 : 0;
    },
    create: (_entity: unknown, value: unknown) => value,
    save: async (entity: unknown, value: Exhibit | ExhibitRevision) => {
      if (failSave) throw new Error('save failed');
      if (entity === Exhibit) exhibits.set(value.id, value as Exhibit);
      else if (entity === ExhibitRevision) {
        const revision = value as ExhibitRevision;
        assert.ok(exhibits.has(revision.exhibitId), 'exhibit must be saved before revision');
        revisions.set(value.id, revision);
      } else throw new Error('Unexpected save');
      return value;
    },
  } as unknown as EntityManager;
  const source = {
    get isInitialized() { return initialized; },
    initialize: async () => { initialized = true; },
    destroy: async () => { destroyed = true; initialized = false; },
    transaction: async (work: (manager: EntityManager) => Promise<unknown>) => {
      const beforeExhibits = structuredClone(exhibits);
      const beforeRevisions = structuredClone(revisions);
      try { return await work(manager); }
      catch (error) {
        exhibits.clear(); revisions.clear();
        beforeExhibits.forEach((value, id) => exhibits.set(id, value));
        beforeRevisions.forEach((value, id) => revisions.set(id, value));
        throw error;
      }
    },
  } as unknown as DataSource;
  return {
    source, room, admin, exhibits, revisions,
    denyAdminRole: () => { hasAdminRole = false; },
    failSave: () => { failSave = true; },
    get destroyed() { return destroyed; },
    get initialized() { return initialized; },
    get roomLocked() { return roomLocked; },
  };
}

it('creates five visible approved pairs in the existing room and leaves its metadata unchanged', async () => {
  const db = database();
  const roomBefore = structuredClone(db.room);
  assert.deepEqual(await seedDemoContent(db.source, 'admin@example.test'), { created: 5, skipped: 0 });
  assert.equal(db.exhibits.size, 5);
  assert.equal(db.revisions.size, 5);
  assert.equal(db.roomLocked, true);
  assert.deepEqual(db.room, roomBefore);
  assert.equal(new Set(DEMO_EXHIBITS.flatMap((item) => [item.id, item.revisionId])).size, 10);
  for (const item of DEMO_EXHIBITS) {
    const exhibit = db.exhibits.get(item.id)!;
    const revision = db.revisions.get(item.revisionId)!;
    assert.equal(exhibit.roomId, db.room.id);
    assert.equal(exhibit.publishedRevisionId, revision.id);
    assert.equal(exhibit.visibility, ExhibitVisibility.VISIBLE);
    assert.equal(exhibit.version, 1);
    assert.equal(revision.exhibitId, exhibit.id);
    assert.equal(revision.state, RevisionState.APPROVED);
    assert.equal(revision.createdById, db.admin.id);
    assert.equal(revision.reviewedById, db.admin.id);
    assert.ok(revision.reviewedAt instanceof Date);
    assert.match(revision.content.name, /^\[Mẫu\]/u);
    assert.match(revision.content.description, /dữ liệu phát triển/u);
    assert.ok(['box', 'sphere', 'cylinder', 'cone', 'torus'].includes(revision.content.placeholderShape!));
    assert.match(revision.content.placeholderColor!, /^#[\da-f]{6}$/i);
    assert.equal(revision.content.position.y, 0);
    assert.ok(Math.abs(revision.content.position.x) <= 4 && Math.abs(revision.content.position.z) <= 4);
  }
});

it('reruns without overwriting edited content, hidden/deleted state or a newer published revision', async () => {
  const db = database();
  await seedDemoContent(db.source, 'admin@example.test');
  const exhibit = db.exhibits.get(DEMO_EXHIBITS[0].id)!;
  exhibit.visibility = ExhibitVisibility.HIDDEN;
  exhibit.version = 7;
  exhibit.isDeleted = true;
  exhibit.deletedAt = new Date();
  exhibit.publishedRevisionId = 'newer-revision-id';
  db.revisions.get(DEMO_EXHIBITS[0].revisionId)!.content.name = 'Edited by user';
  const before = structuredClone({ exhibits: db.exhibits, revisions: db.revisions });
  assert.deepEqual(await seedDemoContent(db.source, 'admin@example.test'), { created: 0, skipped: 5 });
  assert.deepEqual({ exhibits: db.exhibits, revisions: db.revisions }, before);
});

it('rejects a demo ID belonging to another room without leaving partial inserts', async () => {
  const db = database();
  await seedDemoContent(db.source, 'admin@example.test');
  const last = DEMO_EXHIBITS[4];
  db.exhibits.get(last.id)!.roomId = 'another-room';
  for (const item of DEMO_EXHIBITS.slice(0, 4)) {
    db.exhibits.delete(item.id); db.revisions.delete(item.revisionId);
  }
  await assert.rejects(seedDemoContent(db.source, 'admin@example.test'), /không nhất quán/u);
  assert.equal(db.exhibits.size, 1);
});

it('rejects missing halves or a revision belonging to a different exhibit', async () => {
  for (const problem of ['exhibit-missing', 'revision-missing', 'wrong-parent']) {
    const db = database();
    await seedDemoContent(db.source, 'admin@example.test');
    const item = DEMO_EXHIBITS[0];
    if (problem === 'exhibit-missing') db.exhibits.delete(item.id);
    else if (problem === 'revision-missing') db.revisions.delete(item.revisionId);
    else db.revisions.get(item.revisionId)!.exhibitId = 'another-exhibit';
    await assert.rejects(seedDemoContent(db.source, 'admin@example.test'), /không nhất quán/u);
  }
});

it('requires an active room and active admin with the admin role before writing', async () => {
  for (const problem of ['archived-room', 'deleted-room', 'disabled-user', 'deleted-user', 'missing-role']) {
    const db = database();
    if (problem === 'archived-room') db.room.status = RoomStatus.ARCHIVED;
    if (problem === 'deleted-room') db.room.isDeleted = true;
    if (problem === 'disabled-user') db.admin.status = UserStatus.DISABLED;
    if (problem === 'deleted-user') db.admin.isDeleted = true;
    if (problem === 'missing-role') db.denyAdminRole();
    await assert.rejects(seedDemoContent(db.source, 'admin@example.test'), /phòng|admin/u);
    assert.equal(db.exhibits.size, 0);
  }
});

it('validates environment before connecting and closes the connection on success or failure', async () => {
  const env = { DATABASE_URL: 'postgres://example', SEED_ADMIN_EMAIL: 'admin@example.test' };
  const missing = database();
  await assert.rejects(runDemoContentSeed(missing.source, {}), /DATABASE_URL/u);
  await assert.rejects(runDemoContentSeed(missing.source, { DATABASE_URL: env.DATABASE_URL }), /SEED_ADMIN_EMAIL/u);
  assert.equal(missing.initialized, false);
  for (const fail of [false, true]) {
    const db = database();
    if (fail) db.failSave();
    if (fail) await assert.rejects(runDemoContentSeed(db.source, env), /save failed/u);
    else assert.deepEqual(await runDemoContentSeed(db.source, env), { created: 5, skipped: 0 });
    assert.equal(db.destroyed, true);
    assert.equal(db.initialized, false);
  }
});
