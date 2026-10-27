import 'reflect-metadata';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { resolve } from 'node:path';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { ContentReport } from '../../content-reports/entities/content-report.entity';
import { ExhibitsService } from '../services/exhibits.service';
import { ExhibitsRepository } from '../repositories/exhibits.repository';
import { Exhibit, ExhibitVisibility } from '../entities/exhibit.entity';
import { ExhibitRevision, RevisionState } from '../entities/exhibit-revision.entity';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { UpdateExhibitDto } from '../dto/update-exhibit.dto';
import { ModerationService } from '../../moderation/services/moderation.service';
import { ModerationRepository } from '../../moderation/repositories/moderation.repository';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AdminExhibitsController } from '../controllers/admin-exhibits.controller';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';

function setup(states: RevisionState[] = []) {
  const exhibit: Exhibit = Object.assign(new Exhibit(), { id: 'fixture', publishedRevisionId: null, visibility: ExhibitVisibility.HIDDEN, version: 1, isDeleted: false });
  const revisions = states.map((state, index) => Object.assign(new ExhibitRevision(), { id: `rev-${index}`, state, revisionNo: index + 1, exhibitId: exhibit.id, content: {}, hotspots: [] }));
  const manager = {} as EntityManager;
  const log: string[] = [];
  let present = true, reports = false, failDelete: unknown;
  const repo = {
    findAdminDetailById: async () => exhibit,
    findForUpdate: async (_id: string, m: EntityManager) => { assert.equal(m, manager); log.push('lock-exhibit'); return present ? exhibit : null; },
    findRevisionsForDeletion: async (_id: string, m: EntityManager) => { assert.equal(m, manager); log.push('lock-revisions'); return revisions; },
    hasReportReferences: async (_id: string, ids: string[], m: EntityManager) => { assert.equal(m, manager); assert.deepEqual(ids, revisions.map(r => r.id)); log.push('reports'); return reports; },
    isReportReferenceConflict: (error: unknown) => error === 'report-fk',
    markDeleted: async (_ids: string[], m: EntityManager) => { assert.equal(m, manager); log.push('delete'); if (failDelete) throw failDelete; present = false; },
    findActiveRevision: async () => revisions.at(-1) ?? null,
    save: async () => { log.push('save-exhibit'); return exhibit; },
    saveRevision: async (r: ExhibitRevision) => { log.push('save-revision'); return r; },
  };
  const tx = { run: async (work: (m: EntityManager) => unknown) => { log.push('begin'); try { return await work(manager); } catch (e) { log.push('rollback'); throw e; } } } as TransactionManager;
  const gate = { assertPublishable: async () => { present = false; } };
  const media = { assertAttachable: async () => { present = false; } };
  const service = new ExhibitsService(repo as unknown as ExhibitsRepository, {} as never, tx, media as never, gate as never, {} as never);
  return { service, exhibit, revisions, log, setPresent: (value: boolean) => { present = value; }, setReports: () => { reports = true; }, fail: (error: unknown) => { failDelete = error; } };
}

describe('Whole exhibit deletion policy', () => {
  for (const states of [[], [RevisionState.DRAFT], [RevisionState.REJECTED], [RevisionState.DRAFT, RevisionState.REJECTED]]) {
    it(`deletes only unprotected revisions (${states.join(',') || 'none'}) in one transaction`, async () => {
      const { service, log } = setup(states);
      assert.equal((await service.deleteExhibitDraft('fixture')).success, true);
      assert.deepEqual(log, ['begin', 'lock-exhibit', 'lock-revisions', 'reports', 'delete']);
    });
  }
  for (const state of [RevisionState.APPROVED, RevisionState.IN_REVIEW]) {
    it(`blocks ${state} even if an older revision and latest is draft`, async () => {
      const { service, log } = setup([state, RevisionState.DRAFT]);
      await assert.rejects(() => service.deleteExhibitDraft('fixture'), ConflictException);
      assert.equal(log.includes('delete'), false);
    });
  }
  for (const kind of ['published', 'visible']) {
    it(`blocks ${kind} without misleading hide-then-delete advice`, async () => {
      const { service, exhibit } = setup();
      if (kind === 'published') exhibit.publishedRevisionId = 'published';
      else exhibit.visibility = ExhibitVisibility.VISIBLE;
      await assert.rejects(() => service.deleteExhibitDraft('fixture'), (e: Error) => e instanceof ConflictException && !e.message.includes('ẩn (Hide/Unpublish) hiện vật trước'));
    });
  }
  it('blocks existing reports of any status before cascade', async () => {
    const state = setup([RevisionState.DRAFT]); state.setReports();
    await assert.rejects(() => state.service.deleteExhibitDraft('fixture'), ConflictException);
    assert.equal(state.log.includes('delete'), false);
  });
  it('rechecks existence inside the transaction', async () => {
    const state = setup(); state.setPresent(false);
    await assert.rejects(() => state.service.deleteExhibitDraft('fixture'), NotFoundException);
  });
  for (const error of ['report-fk', new Error('unrelated failure')]) {
    it(`rolls back and maps only recognized report constraints (${String(error)})`, async () => {
      const state = setup(); state.fail(error);
      await assert.rejects(() => state.service.deleteExhibitDraft('fixture'), e => error === 'report-fk' ? e instanceof ConflictException : e === error);
      assert.equal(state.log.at(-1), 'rollback');
    });
  }
  it('a submit paused at the media gate cannot resurrect an exhibit deleted meanwhile', async () => {
    const state = setup([RevisionState.DRAFT]);
    await assert.rejects(() => state.service.submitDraftForReview('fixture'), NotFoundException);
    assert.equal(state.log.includes('save-revision'), false);
    assert.equal(state.log.includes('save-exhibit'), false);
  });
  it('an update paused at the media gate cannot resurrect an exhibit deleted meanwhile', async () => {
    const state = setup([RevisionState.DRAFT]);
    await assert.rejects(() => state.service.updateExhibitDraft('fixture', new UpdateExhibitDto(), { id: 'actor' }), NotFoundException);
    assert.equal(state.log.includes('save-exhibit'), false);
  });

  for (const method of ['submit', 'update']) {
    it(`${method} refuses a changed revision after obtaining the exhibit lock`, async () => {
      const state = setup([RevisionState.DRAFT]);
      // A second writer changed the active state while media checks were pending.
      const repo = (state.service as unknown as { exhibits: ExhibitsRepository }).exhibits;
      let reads = 0;
      repo.findActiveRevision = async () => Object.assign(new ExhibitRevision(), state.revisions[0], { state: ++reads === 1 ? RevisionState.DRAFT : RevisionState.IN_REVIEW });
      repo.findForUpdate = async () => state.exhibit;
      await assert.rejects(() => method === 'submit' ? state.service.submitDraftForReview('fixture')
        : state.service.updateExhibitDraft('fixture', new UpdateExhibitDto(), { id: 'actor' }), ConflictException);
      assert.equal(state.log.includes('save-revision'), false);
      assert.equal(state.log.includes('save-exhibit'), false);
    });
  }

  it('a stale publish snapshot cannot recreate an exhibit deleted before its conditional update', async () => {
    const state = setup([RevisionState.DRAFT]);
    const snapshot = Object.assign(new ExhibitRevision(), state.revisions[0], { state: RevisionState.IN_REVIEW });
    const updates: unknown[] = [];
    const manager = { update: async (target: unknown) => { updates.push(target); return { affected: 0 }; } } as unknown as EntityManager;
    const moderation = new ModerationService(
      { findDetail: async () => snapshot } as unknown as ModerationRepository,
      { run: async (work: (m: EntityManager) => unknown) => work(manager) } as TransactionManager,
      { assertPublishable: async () => { await state.service.deleteExhibitDraft('fixture'); } } as never,
    );
    await assert.rejects(() => moderation.publish(snapshot.id, { version: 1 }, { id: 'actor' } as never), ConflictException);
    assert.deepEqual(updates, [Exhibit]);
    await assert.rejects(() => state.service.deleteExhibitDraft('fixture'), NotFoundException);
  });

  it('bulk: one protected exhibit blocks the whole batch (409 lists it), nothing is soft-deleted', async () => {
    const { service, log, exhibit } = setup([RevisionState.DRAFT]);
    exhibit.publishedRevisionId = 'published';
    await assert.rejects(() => service.removeMany(['fixture']), (e: unknown) => {
      assert.ok(e instanceof ConflictException);
      const body = e.getResponse() as { errors: Array<{ field: string }> };
      assert.deepEqual(body.errors.map(item => item.field), ['fixture']);
      return true;
    });
    assert.equal(log.includes('delete'), false);
  });

  it('bulk: all deletable → soft-deletes in one transaction and returns ids for audit', async () => {
    const { service, log } = setup([RevisionState.DRAFT]);
    assert.deepEqual(await service.removeMany(['fixture']), { ids: ['fixture'] });
    assert.deepEqual(log, ['begin', 'lock-exhibit', 'lock-revisions', 'reports', 'delete']);
  });
});

describe('Deletion repository guards and report constraint identities', () => {
  const db = new DataSource({ type: 'postgres', entities: [resolve(__dirname, '../../**/entities/*.entity.ts')], synchronize: false });
  before(async () => { await (db as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas(); });

  it('locks scalar rows and checks both exhibit and cross-referenced revision reports', async () => {
    const calls: { target: unknown; method: string; options: unknown }[] = [];
    const manager = { getRepository: (target: unknown) => ({
      findOne: async (options: unknown) => { calls.push({ target, method: 'findOne', options }); return null; },
      find: async (options: unknown) => { calls.push({ target, method: 'find', options }); return []; },
      exists: async (options: unknown) => { calls.push({ target, method: 'exists', options }); return true; },
    }) } as unknown as EntityManager;
    const repo = new ExhibitsRepository(db.getRepository(Exhibit), db.getRepository(ExhibitRevision), db.getRepository((await import('../entities/hotspot.entity')).Hotspot));
    await repo.findForUpdate('fixture', manager);
    await repo.findRevisionsForDeletion('fixture', manager);
    assert.equal(await repo.hasReportReferences('fixture', ['cross-ref'], manager), true);
    assert.deepEqual(calls[0].options, { where: { id: 'fixture', isDeleted: false }, lock: { mode: 'pessimistic_write' } });
    assert.deepEqual(calls[1].options, { where: { exhibitId: 'fixture' }, order: { id: 'ASC' }, lock: { mode: 'pessimistic_write' } });
    assert.equal(calls[2].target, ContentReport);
    const where = (calls[2].options as { where: { exhibitId?: string; reportedRevisionId?: { value: string[] } }[] }).where;
    assert.equal(where[0].exhibitId, 'fixture');
    assert.deepEqual(where[1].reportedRevisionId?.value, ['cross-ref']);
  });

  it('recognizes only PostgreSQL report FKs targeting exhibits or revisions', async () => {
    const repo = new ExhibitsRepository(db.getRepository(Exhibit), db.getRepository(ExhibitRevision), db.getRepository((await import('../entities/hotspot.entity')).Hotspot));
    for (const fk of db.getMetadata(ContentReport).foreignKeys) {
      const error = new QueryFailedError('DELETE', [], Object.assign(new Error('FK violation'), { code: '23503', constraint: fk.name }));
      assert.equal(repo.isReportReferenceConflict(error), [Exhibit, ExhibitRevision].includes(fk.referencedEntityMetadata.target as typeof Exhibit));
    }
    assert.equal(repo.isReportReferenceConflict(new Error('other')), false);
    assert.equal(repo.isReportReferenceConflict({ driverError: { code: '23505', constraint: 'other' } }), false);
    assert.equal(repo.isReportReferenceConflict({ driverError: { code: '23503', constraint: 'unknown_fk' } }), false);
  });
});

describe('Whole exhibit deletion HTTP errors', () => {
  for (const status of [404, 409]) {
    it(`returns the standard ${status} envelope with the policy reason`, async () => {
      const reason = status === 404 ? 'Không tìm thấy hiện vật' : 'Hiện vật có báo cáo liên quan nên không thể xóa vĩnh viễn.';
      const module = await Test.createTestingModule({
        controllers: [AdminExhibitsController],
        providers: [{ provide: ExhibitsService, useValue: { deleteExhibitDraft: async () => {
          throw status === 404 ? new NotFoundException(reason) : new ConflictException(reason);
        } } }],
      }).compile();
      const app = module.createNestApplication();
      app.useGlobalInterceptors(new ResponseInterceptor());
      app.useGlobalFilters(new AllExceptionsFilter());
      try {
        await app.init();
        const response = await request(app.getHttpServer()).delete('/admin/exhibits/10000000-0000-4000-8000-000000000001').expect(status);
        assert.equal(response.body.success, false);
        assert.equal(response.body.message, reason);
        assert.equal(response.body.data, null);
      } finally { await app.close(); }
    });
  }
});
