import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
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
import { RevisionPublishGate } from '../../exhibits/services/revision-publish.gate';

/** Cổng Submit/Publish giả: mặc định cho qua (luật cổng được test riêng). */
const passGate = { assertPublishable: () => Promise.resolve() } as unknown as RevisionPublishGate;

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
    const svc = new ModerationService(fakeRepo({ revision: null }), fakeTx([]), passGate);
    await assert.rejects(() => svc.publish('x', { version: 3 }, ACTOR), NotFoundException);
  });

  it('ném 409 khi revision không ở trạng thái chờ duyệt', async () => {
    const revision = sampleRevision({ state: RevisionState.APPROVED });
    const svc = new ModerationService(fakeRepo({ revision }), fakeTx([]), passGate);
    await assert.rejects(() => svc.publish('d', { version: 3 }, ACTOR), ConflictException);
  });

  it('ném 409 khi version lệch (update exhibit affected = 0)', async () => {
    const revision = sampleRevision();
    const svc = new ModerationService(fakeRepo({ revision }), fakeTx([0]), passGate);
    await assert.rejects(() => svc.publish('d', { version: 99 }, ACTOR), ConflictException);
  });

  it('thành công khi version khớp', async () => {
    const revision = sampleRevision();
    const svc = new ModerationService(fakeRepo({ revision }), fakeTx([1, 1]), passGate);
    const res = await svc.publish('d', { version: 3 }, ACTOR);
    assert.equal(res.id, revision.id);
  });
});

describe('ModerationService.publish — cổng Submit/Publish (Task 9)', () => {
  /** Tx ghi lại thứ tự gọi để chứng minh cổng chạy trước mọi lệnh ghi, cùng manager. */
  function recordingTx(log: string[]): { tx: TransactionManager; manager: EntityManager } {
    const manager = {
      update: () => {
        log.push('update');
        return Promise.resolve({ affected: 1 });
      },
    } as unknown as EntityManager;
    const tx = { run: (work: (m: EntityManager) => unknown) => work(manager) } as unknown as TransactionManager;
    return { tx, manager };
  }

  it('gọi cổng với đúng revision + manager của transaction, trước mọi update', async () => {
    const log: string[] = [];
    const { tx, manager } = recordingTx(log);
    const revision = sampleRevision();
    const gate = {
      assertPublishable: (target: ExhibitRevision, m: EntityManager) => {
        assert.equal(target, revision);
        assert.equal(m, manager);
        log.push('gate');
        return Promise.resolve();
      },
    } as unknown as RevisionPublishGate;
    await new ModerationService(fakeRepo({ revision }), tx, gate).publish('d', { version: 3 }, ACTOR);
    assert.deepEqual(log, ['gate', 'update', 'update']);
  });

  it('cổng từ chối → 422, không update exhibit/revision nào', async () => {
    const log: string[] = [];
    const { tx } = recordingTx(log);
    const gate = {
      assertPublishable: () => Promise.reject(new UnprocessableEntityException({ message: 'x', errors: [] })),
    } as unknown as RevisionPublishGate;
    await assert.rejects(
      new ModerationService(fakeRepo({ revision: sampleRevision() }), tx, gate).publish('d', { version: 3 }, ACTOR),
      UnprocessableEntityException,
    );
    assert.deepEqual(log, []);
  });

  it('revision không ở in_review → 409, không gọi cổng', async () => {
    let called = false;
    const gate = { assertPublishable: () => ((called = true), Promise.resolve()) } as unknown as RevisionPublishGate;
    const revision = sampleRevision({ state: RevisionState.REJECTED });
    await assert.rejects(new ModerationService(fakeRepo({ revision }), fakeTx([]), gate).publish('d', { version: 3 }, ACTOR), ConflictException);
    assert.equal(called, false);
  });
});

describe('ModerationService.diff — media', () => {
  it('thêm 6 dòng media; đánh dấu changed theo id media từng slot', async () => {
    const published = Object.assign(sampleRevision({ id: 'p', revisionNo: 1, state: RevisionState.APPROVED }), {
      modelMediaId: 'm1',
      audioEnMediaId: 'a1',
    });
    const exhibit = sampleExhibit({ publishedRevisionId: 'p' });
    exhibit.publishedRevision = published;
    const target = Object.assign(sampleRevision({ exhibit }), {
      modelMediaId: 'm2',
      audioEnMediaId: 'a1',
      subtitleViMediaId: 's1',
    });
    const repo = { findForDiff: () => Promise.resolve(target) } as unknown as ModerationRepository;
    const diff = await new ModerationService(repo, fakeTx([]), passGate).diff('d');
    const media = Object.fromEntries(diff.fields.filter((f) => f.field.startsWith('media.')).map((f) => [f.field, [f.oldValue, f.newValue, f.changed]]));
    assert.deepEqual(media, {
      'media.model': ['m1', 'm2', true],
      'media.image': [null, null, false],
      'media.audioVi': [null, null, false],
      'media.audioEn': ['a1', 'a1', false],
      'media.subtitleVi': [null, 's1', true],
      'media.subtitleEn': [null, null, false],
    });
  });

  it('hiện vật chưa từng xuất bản → oldValue null cho mọi slot', async () => {
    const target = Object.assign(sampleRevision(), { imageMediaId: 'i1' });
    const repo = { findForDiff: () => Promise.resolve(target) } as unknown as ModerationRepository;
    const diff = await new ModerationService(repo, fakeTx([]), passGate).diff('d');
    const image = diff.fields.find((f) => f.field === 'media.image')!;
    assert.deepEqual([image.oldValue, image.newValue, image.changed], [null, 'i1', true]);
  });
});

describe('ModerationService.reject', () => {
  it('ném 409 khi version lệch', async () => {
    const revision = sampleRevision({ exhibit: sampleExhibit({ version: 3 }) });
    const svc = new ModerationService(fakeRepo({ revision }), fakeTx([1]), passGate);
    await assert.rejects(() => svc.reject('d', { version: 1, reason: 'x' }, ACTOR), ConflictException);
  });

  it('thành công khi version khớp và còn in_review', async () => {
    const revision = sampleRevision({ exhibit: sampleExhibit({ version: 3 }) });
    const svc = new ModerationService(fakeRepo({ revision }), fakeTx([1]), passGate);
    const res = await svc.reject('d', { version: 3, reason: 'Sai niên đại' }, ACTOR);
    assert.equal(res.id, revision.id);
  });
});

describe('ModerationService.hide/unhide', () => {
  it('ném 404 khi không có hiện vật', async () => {
    const svc = new ModerationService(fakeRepo({ exhibit: null }), fakeTx([]), passGate);
    await assert.rejects(() => svc.hide('e', { version: 3 }), NotFoundException);
  });

  it('ném 409 khi version lệch', async () => {
    const svc = new ModerationService(fakeRepo({ exhibit: sampleExhibit() }), fakeTx([0]), passGate);
    await assert.rejects(() => svc.hide('e', { version: 99 }), ConflictException);
  });

  it('thành công khi version khớp', async () => {
    const svc = new ModerationService(
      fakeRepo({ exhibit: sampleExhibit({ version: 3 }) }),
      fakeTx([1]),
      passGate,
    );
    const res = await svc.hide('e', { version: 3 });
    assert.equal(res.id, 'e1111111-1111-4111-1111-111111111111');
  });
});
