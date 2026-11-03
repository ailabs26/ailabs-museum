import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { ConflictException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import request from 'supertest';
import { EntityManager } from 'typeorm';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import { MediaReferenceValidator } from '../../media/services/media-reference.validator';
import { testMediaUrlService } from '../../media/tests/media-test-doubles';
import { RoomsRepository } from '../../rooms/repositories/rooms.repository';
import { AdminExhibitsController } from '../controllers/admin-exhibits.controller';
import { UpdateExhibitDto } from '../dto/update-exhibit.dto';
import { ExhibitRevision, ExhibitRevisionContent, RevisionState } from '../entities/exhibit-revision.entity';
import { Exhibit, ExhibitVisibility } from '../entities/exhibit.entity';
import { ExhibitsRepository } from '../repositories/exhibits.repository';
import { ExhibitsService } from '../services/exhibits.service';
import { RevisionPublishGate } from '../services/revision-publish.gate';
import { notificationsStub } from '../../notifications/tests/notifications.stub';

/**
 * VT-079 — lưu nháp tự động không được để bản cũ ghi đè bản mới.
 * Oracle lấy từ decision table trong docs/bt3/VT-079/README.md (R1–R4), không từ implementation.
 */
const EXHIBIT_ID = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';
const REVISION_ID = 'c1d2e3f4-a5b6-4890-8def-1234567890ab';
const USER = { id: 'f1e2d3c4-b5a6-4890-8edc-ba9876543210' };

function draftDto(plain: Record<string, unknown>): UpdateExhibitDto {
  return plainToInstance(UpdateExhibitDto, plain);
}

async function invalidFields(plain: Record<string, unknown>): Promise<string[]> {
  return (await validate(draftDto(plain))).map((e) => e.property);
}

describe('VT-079 · UpdateExhibitDto.expectedVersion (R4)', () => {
  it('TC01: thiếu expectedVersion là không hợp lệ — autosave phải nói rõ nó dựa trên version nào', async () => {
    assert.ok((await invalidFields({ name: { vi: 'Bản A' } })).includes('expectedVersion'));
  });

  it('TC02: expectedVersion âm hoặc không phải số nguyên bị từ chối; 0 (cận dưới) hợp lệ', async () => {
    assert.ok((await invalidFields({ expectedVersion: -1 })).includes('expectedVersion'));
    assert.ok((await invalidFields({ expectedVersion: 'abc' })).includes('expectedVersion'));
    assert.ok((await invalidFields({ expectedVersion: 1.5 })).includes('expectedVersion'));
    assert.deepEqual(await invalidFields({ expectedVersion: 0 }), []);
  });
});

/** Repository giả tối thiểu: một hiện vật ở `version` cho trước, ghi lại mọi lần ghi. */
class FakeExhibitsRepository {
  writes: string[] = [];
  constructor(private readonly exhibit: Exhibit, private readonly revision: ExhibitRevision) {}
  async findAdminDetailById() { return this.exhibit; }
  async findForUpdate() { return this.exhibit; }
  async findActiveRevision() { return this.revision; }
  async findLatestRevisionNo() { return this.revision.revisionNo; }
  async save(entity: Exhibit) { this.writes.push(`exhibit@${entity.version}`); return entity; }
  async saveRevision(rev: ExhibitRevision) { this.writes.push('revision'); return rev; }
  async saveHotspots() { this.writes.push('hotspots'); return []; }
  async deleteHotspotsByRevisionIds() { this.writes.push('hotspots-delete'); }
}

function makeService(dbVersion: number) {
  const exhibit = Object.assign(new Exhibit(), {
    id: EXHIBIT_ID, roomId: 'e4b50c18-971c-4b68-b39f-f5cf171a8123', version: dbVersion,
    visibility: ExhibitVisibility.HIDDEN, publishedRevisionId: null, publishedRevision: null,
    displayOrder: 1, isDeleted: false, deletedAt: null, archivedAt: null,
    createdAt: new Date('2026-10-10T10:00:00Z'), updatedAt: new Date('2026-10-10T10:00:00Z'),
  });
  const revision = Object.assign(new ExhibitRevision(), {
    id: REVISION_ID, exhibitId: EXHIBIT_ID, revisionNo: 1, state: RevisionState.DRAFT,
    content: { name: { vi: 'Bản mới nhất' }, description: { vi: 'Mô tả' } } as unknown as ExhibitRevisionContent,
    hotspots: [], createdById: USER.id,
  });
  const repo = new FakeExhibitsRepository(exhibit, revision);
  const tx = { run: <T>(work: (m: EntityManager) => Promise<T>) => work({} as EntityManager) };
  const service = new ExhibitsService(
    repo as unknown as ExhibitsRepository,
    {} as RoomsRepository,
    tx as unknown as TransactionManager,
    { assertAttachable: async () => undefined } as unknown as MediaReferenceValidator,
    {} as RevisionPublishGate,
    testMediaUrlService(),
    notificationsStub(),
  );
  return { service, repo, exhibit };
}

describe('VT-079 · ExhibitsService.updateExhibitDraft với expectedVersion', () => {
  it('TC03 (R2): version client cũ hơn DB → 409 và không ghi gì', async () => {
    const { service, repo } = makeService(3);
    await assert.rejects(
      service.updateExhibitDraft(EXHIBIT_ID, draftDto({ name: { vi: 'Bản cũ' }, expectedVersion: 2 }), USER),
      ConflictException,
    );
    assert.deepEqual(repo.writes, []);
  });

  it('TC04 (R3): version client lớn hơn DB (không có thật) → 409 và không ghi gì', async () => {
    const { service, repo } = makeService(3);
    await assert.rejects(
      service.updateExhibitDraft(EXHIBIT_ID, draftDto({ name: { vi: 'Bản lạ' }, expectedVersion: 4 }), USER),
      ConflictException,
    );
    assert.deepEqual(repo.writes, []);
  });

  it('TC05 (R1): version khớp → lưu nội dung mới và version tăng đúng 1', async () => {
    const { service, repo } = makeService(3);
    const saved = await service.updateExhibitDraft(
      EXHIBIT_ID, draftDto({ name: { vi: 'Bản mới' }, expectedVersion: 3 }), USER,
    );
    assert.equal(saved.version, 4);
    assert.equal((saved.content.name as unknown as { vi: string }).vi, 'Bản mới');
    assert.deepEqual(repo.writes, ['exhibit@4', 'revision']);
  });
});

describe('VT-079 · PATCH /admin/exhibits/:id (HTTP + ValidationPipe như main.ts)', () => {
  const apps: INestApplication[] = [];
  after(async () => { await Promise.all(apps.map((app) => app.close())); });

  async function makeApp(calls: UpdateExhibitDto[]) {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminExhibitsController],
      providers: [{
        provide: ExhibitsService,
        useValue: { updateExhibitDraft: async (_id: string, dto: UpdateExhibitDto) => { calls.push(dto); return { id: EXHIBIT_ID }; } },
      }],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    apps.push(app);
    return app;
  }

  it('TC10 (R4): PATCH thiếu expectedVersion → 400 và service không được gọi', async () => {
    const calls: UpdateExhibitDto[] = [];
    const app = await makeApp(calls);
    await request(app.getHttpServer())
      .patch(`/admin/exhibits/${EXHIBIT_ID}`)
      .send({ name: { vi: 'Bản không rõ gốc' } })
      .expect(400);
    assert.equal(calls.length, 0);
  });

  it('TC10b: PATCH có expectedVersion hợp lệ đi tới service với giá trị số nguyên', async () => {
    const calls: UpdateExhibitDto[] = [];
    const app = await makeApp(calls);
    await request(app.getHttpServer())
      .patch(`/admin/exhibits/${EXHIBIT_ID}`)
      .send({ name: { vi: 'Bản A' }, expectedVersion: 7 })
      .expect(200);
    assert.equal(calls[0]?.expectedVersion, 7);
  });
});
