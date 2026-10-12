import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { AuthUser } from '../../../common/types/auth-user.type';
import {
  ExhibitRevision,
  RevisionState,
} from '../../exhibits/entities/exhibit-revision.entity';
import { Exhibit, ExhibitVisibility } from '../../exhibits/entities/exhibit.entity';
import { ModerationRepository } from '../repositories/moderation.repository';
import { ModerationService } from '../services/moderation.service';

const ACTOR: AuthUser = {
  id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  email: 'mod@aura.local',
  displayName: 'Mod',
  roles: ['moderator'],
  permissions: [],
};

function sampleExhibit(overrides?: Partial<Exhibit>): Exhibit {
  const e = new Exhibit();
  e.id = overrides?.id ?? 'e1111111-1111-4111-1111-111111111111';
  e.roomId = overrides?.roomId ?? 'r1111111-1111-4111-1111-111111111111';
  e.version = overrides?.version ?? 3;
  e.visibility = overrides?.visibility ?? ExhibitVisibility.VISIBLE;
  e.publishedRevisionId = overrides?.publishedRevisionId ?? null;
  e.isDeleted = overrides?.isDeleted ?? false;
  return e;
}

function sampleRevision(overrides?: Partial<ExhibitRevision>): ExhibitRevision {
  const r = new ExhibitRevision();
  r.id = overrides?.id ?? 'd1111111-1111-4111-1111-111111111111';
  r.exhibitId = overrides?.exhibitId ?? 'e1111111-1111-4111-1111-111111111111';
  r.revisionNo = overrides?.revisionNo ?? 2;
  r.state = overrides?.state ?? RevisionState.IN_REVIEW;
  r.content = overrides?.content ?? {
    name: 'A',
    description: 'desc',
    position: { x: 0, y: 0, z: 0 },
  };
  r.reason = overrides?.reason ?? null;
  r.createdAt = overrides?.createdAt ?? new Date('2026-10-10T00:00:00Z');
  r.reviewedAt = overrides?.reviewedAt ?? null;
  r.exhibit = overrides?.exhibit ?? sampleExhibit();
  return r;
}

/** Repo giả cho phép cấu hình kết quả findDetail/findExhibit. */
function fakeRepo(opts: {
  revision?: ExhibitRevision | null;
  exhibit?: Exhibit | null;
}): ModerationRepository {
  return {
    findDetail: () => Promise.resolve(opts.revision ?? null),
    findExhibit: () => Promise.resolve(opts.exhibit ?? null),
  } as unknown as ModerationRepository;
}

/** TransactionManager giả: mỗi update() lấy affected kế tiếp trong hàng đợi. */
function fakeTx(affectedQueue: number[]): TransactionManager {
  const manager = {
    update: () => Promise.resolve({ affected: affectedQueue.shift() ?? 0 }),
  } as unknown as EntityManager;
  return { run: (work: (m: EntityManager) => unknown) => work(manager) } as unknown as TransactionManager;
}

describe('ModerationService.publish', () => {
  it('ném 404 khi không có revision', async () => {
    const svc = new ModerationService(fakeRepo({ revision: null }), fakeTx([]));
    await assert.rejects(() => svc.publish('x', { version: 3 }, ACTOR), NotFoundException);
  });

  it('ném 409 khi revision không ở trạng thái chờ duyệt', async () => {
    const revision = sampleRevision({ state: RevisionState.APPROVED });
    const svc = new ModerationService(fakeRepo({ revision }), fakeTx([]));
    await assert.rejects(() => svc.publish('d', { version: 3 }, ACTOR), ConflictException);
  });

  it('ném 409 khi version lệch (update exhibit affected = 0)', async () => {
    const revision = sampleRevision();
    const svc = new ModerationService(fakeRepo({ revision }), fakeTx([0]));
    await assert.rejects(() => svc.publish('d', { version: 99 }, ACTOR), ConflictException);
  });

  it('thành công khi version khớp', async () => {
    const revision = sampleRevision();
    const svc = new ModerationService(fakeRepo({ revision }), fakeTx([1, 1]));
    const res = await svc.publish('d', { version: 3 }, ACTOR);
    assert.equal(res.id, revision.id);
  });
});

describe('ModerationService.reject', () => {
  it('ném 409 khi version lệch', async () => {
    const revision = sampleRevision({ exhibit: sampleExhibit({ version: 3 }) });
    const svc = new ModerationService(fakeRepo({ revision }), fakeTx([1]));
    await assert.rejects(() => svc.reject('d', { version: 1, reason: 'x' }, ACTOR), ConflictException);
  });

  it('thành công khi version khớp và còn in_review', async () => {
    const revision = sampleRevision({ exhibit: sampleExhibit({ version: 3 }) });
    const svc = new ModerationService(fakeRepo({ revision }), fakeTx([1]));
    const res = await svc.reject('d', { version: 3, reason: 'Sai niên đại' }, ACTOR);
    assert.equal(res.id, revision.id);
  });
});

describe('ModerationService.hide/unhide', () => {
  it('ném 404 khi không có hiện vật', async () => {
    const svc = new ModerationService(fakeRepo({ exhibit: null }), fakeTx([]));
    await assert.rejects(() => svc.hide('e', { version: 3 }), NotFoundException);
  });

  it('ném 409 khi version lệch', async () => {
    const svc = new ModerationService(fakeRepo({ exhibit: sampleExhibit() }), fakeTx([0]));
    await assert.rejects(() => svc.hide('e', { version: 99 }), ConflictException);
  });

  it('thành công khi version khớp', async () => {
    const svc = new ModerationService(
      fakeRepo({ exhibit: sampleExhibit({ version: 3 }) }),
      fakeTx([1]),
    );
    const res = await svc.hide('e', { version: 3 });
    assert.equal(res.id, 'e1111111-1111-4111-1111-111111111111');
  });
});
