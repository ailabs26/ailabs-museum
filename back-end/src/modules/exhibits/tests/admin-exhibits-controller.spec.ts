import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, ConflictException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AUDIT_KEY } from '../../audit/decorators/audit.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { PERMISSIONS_KEY } from '../../../common/decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { AuthUser } from '../../../common/types/auth-user.type';
import { Paginated } from '../../../common/types/paginated.type';
import { AdminExhibitsController } from '../controllers/admin-exhibits.controller';
import { CreateExhibitDto } from '../dto/create-exhibit.dto';
import {
  ExhibitAdminDetailResponse,
  ExhibitAdminResponse,
} from '../dto/exhibit-response.dto';
import { ListExhibitsQueryDto } from '../dto/list-exhibits-query.dto';
import { ReorderExhibitsDto } from '../dto/reorder-exhibits.dto';
import { UpdateExhibitDto } from '../dto/update-exhibit.dto';
import { ExhibitRevision, RevisionState } from '../entities/exhibit-revision.entity';
import { ExhibitVisibility } from '../entities/exhibit.entity';
import { ExhibitsService } from '../services/exhibits.service';

// =============================================================================
// Helper Factories & Mock Data
// =============================================================================

function createMockAuthUser(overrides?: Partial<AuthUser>): AuthUser {
  return {
    id: overrides?.id ?? '11111111-1111-4111-a111-111111111111',
    email: overrides?.email ?? 'curator@auramuseum.org',
    displayName: overrides?.displayName ?? 'Curator Thành',
    roles: overrides?.roles ?? ['editor', 'admin'],
    permissions: overrides?.permissions ?? [
      PERMISSIONS.EXHIBIT_READ,
      PERMISSIONS.EXHIBIT_CREATE,
      PERMISSIONS.EXHIBIT_UPDATE,
      PERMISSIONS.REVISION_SUBMIT,
    ],
  };
}

function createMockExhibitAdminResponse(
  overrides?: Partial<ExhibitAdminResponse>,
): ExhibitAdminResponse {
  return {
    id: overrides?.id ?? 'e4b50c18-971c-4b68-b39f-f5cf171a8123',
    roomId: overrides?.roomId ?? 'r1b50c18-971c-4b68-b39f-f5cf171a8123',
    status: overrides?.status ?? 'draft',
    visibility: overrides?.visibility ?? ExhibitVisibility.VISIBLE,
    version: overrides?.version ?? 1,
    displayOrder: overrides?.displayOrder ?? 1,
    publishedRevisionId: overrides?.publishedRevisionId ?? null,
    currentRevisionNo: overrides?.currentRevisionNo ?? 1,
    revisionState: overrides?.revisionState ?? RevisionState.DRAFT,
    content: overrides?.content ?? {
      name: { vi: 'Bình gốm Chu Đậu thế kỷ XV', en: 'Chu Dau Ceramic Vase 15th Century' },
      description: { vi: 'Hiện vật gốm hoa lam thời Lê sơ', en: 'Blue-and-white ceramic vase' },
      position: { x: 1.5, y: 0.8, z: -2.0 },
      rotation: { x: 0, y: 0.5, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      placeholderShape: 'box',
      placeholderColor: '#8b7355',
      transcript: null,
      modelId: null,
      imageId: null,
      audioId: null,
    },
    hotspotsCount: overrides?.hotspotsCount ?? 2,
    createdAt: overrides?.createdAt ?? new Date('2026-10-10T10:00:00Z'),
    updatedAt: overrides?.updatedAt ?? new Date('2026-10-10T12:00:00Z'),
  };
}

function createMockExhibitAdminDetailResponse(
  overrides?: Partial<ExhibitAdminDetailResponse>,
): ExhibitAdminDetailResponse {
  const base = createMockExhibitAdminResponse(overrides);
  return {
    ...base,
    room: overrides && 'room' in overrides ? (overrides.room ?? null) : {
      id: 'r1b50c18-971c-4b68-b39f-f5cf171a8123',
      name: 'Gian phòng Khảo cổ',
      slug: 'gian-phong-khao-co',
    },
    hotspots: overrides?.hotspots ?? [
      {
        id: 'h1b50c18-971c-4b68-b39f-f5cf171a8123',
        label: { vi: 'Họa tiết hoa lam', en: 'Blue floral pattern' },
        body: { vi: 'Chi tiết vẽ lam dưới men', en: 'Underglaze blue detail' },
        position: { x: 0.2, y: 0.5, z: 0.1 },
        displayOrder: 1,
      },
    ],
    revisions: overrides?.revisions ?? [
      {
        id: 'v1b50c18-971c-4b68-b39f-f5cf171a8123',
        revisionNo: 1,
        state: RevisionState.DRAFT,
        createdById: '11111111-1111-4111-a111-111111111111',
        createdBy: { id: '11111111-1111-4111-a111-111111111111', name: 'Curator Thành', email: 'curator@auramuseum.org' },
        reviewedById: null,
        reviewedBy: null,
        reason: null,
        createdAt: new Date('2026-10-10T10:00:00Z'),
        reviewedAt: null,
      },
    ],
  };
}

function createMockRevisionEntity(overrides?: Partial<ExhibitRevision>): ExhibitRevision {
  const rev = new ExhibitRevision();
  rev.id = overrides?.id ?? 'v1b50c18-971c-4b68-b39f-f5cf171a8123';
  rev.exhibitId = overrides?.exhibitId ?? 'e4b50c18-971c-4b68-b39f-f5cf171a8123';
  rev.revisionNo = overrides?.revisionNo ?? 1;
  rev.state = overrides?.state ?? RevisionState.DRAFT;
  rev.createdById = overrides?.createdById ?? '11111111-1111-4111-a111-111111111111';
  rev.content = overrides?.content ?? {
    name: 'Tượng Phật Bà Quan Âm',
    description: 'Bảo vật quốc gia thời Lý',
    position: { x: 0, y: 0, z: 0 },
  };
  rev.reason = overrides?.reason ?? null;
  rev.reviewedById = overrides?.reviewedById ?? null;
  rev.reviewedAt = overrides?.reviewedAt ?? null;
  rev.createdAt = overrides?.createdAt ?? new Date('2026-10-10T10:00:00Z');
  return rev;
}

// =============================================================================
// Mock ExhibitsService
// =============================================================================

class MockExhibitsService {
  searchAdminExhibitsCalls: ListExhibitsQueryDto[] = [];
  searchAdminExhibitsResult: Paginated<ExhibitAdminResponse> = {
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  };
  searchAdminExhibitsError?: Error;

  getAdminDetailCalls: string[] = [];
  getAdminDetailResult: ExhibitAdminDetailResponse = createMockExhibitAdminDetailResponse();
  getAdminDetailError?: Error;

  getRevisionsHistoryCalls: string[] = [];
  getRevisionsHistoryResult: ExhibitRevision[] = [];
  getRevisionsHistoryError?: Error;

  getRevisionDetailCalls: Array<{ id: string; revId: string }> = [];
  getRevisionDetailResult: ExhibitRevision = createMockRevisionEntity();
  getRevisionDetailError?: Error;

  createExhibitDraftCalls: Array<{ dto: CreateExhibitDto; user: AuthUser }> = [];
  createExhibitDraftResult: ExhibitAdminResponse = createMockExhibitAdminResponse();
  createExhibitDraftError?: Error;

  updateExhibitDraftCalls: Array<{ id: string; dto: UpdateExhibitDto; user: AuthUser }> = [];
  updateExhibitDraftResult: ExhibitAdminResponse = createMockExhibitAdminResponse();
  updateExhibitDraftError?: Error;

  submitDraftForReviewCalls: string[] = [];
  submitDraftForReviewResult: ExhibitAdminResponse = createMockExhibitAdminResponse({
    revisionState: RevisionState.IN_REVIEW,
  });
  submitDraftForReviewError?: Error;

  deleteExhibitDraftCalls: string[] = [];
  deleteExhibitDraftResult = { success: true, message: 'Đã xóa hoàn toàn bản nháp hiện vật' };
  deleteExhibitDraftError?: Error;

  deleteDraftRevisionCalls: Array<{ id: string; revId: string }> = [];
  deleteDraftRevisionResult = { success: true, message: 'Đã xóa bản revision nháp thành công' };
  deleteDraftRevisionError?: Error;

  reorderExhibitsCalls: Array<{ roomId: string; exhibitIds: string[] }> = [];
  reorderExhibitsResult = { success: true, message: 'Đã cập nhật thứ tự 3 hiện vật trong phòng' };
  reorderExhibitsError?: Error;

  async searchAdminExhibits(query: ListExhibitsQueryDto): Promise<Paginated<ExhibitAdminResponse>> {
    this.searchAdminExhibitsCalls.push(query);
    if (this.searchAdminExhibitsError) throw this.searchAdminExhibitsError;
    return this.searchAdminExhibitsResult;
  }

  async getAdminDetail(id: string): Promise<ExhibitAdminDetailResponse> {
    this.getAdminDetailCalls.push(id);
    if (this.getAdminDetailError) throw this.getAdminDetailError;
    return this.getAdminDetailResult;
  }

  async getRevisionsHistory(id: string): Promise<ExhibitRevision[]> {
    this.getRevisionsHistoryCalls.push(id);
    if (this.getRevisionsHistoryError) throw this.getRevisionsHistoryError;
    return this.getRevisionsHistoryResult;
  }

  async getRevisionDetail(id: string, revId: string): Promise<ExhibitRevision> {
    this.getRevisionDetailCalls.push({ id, revId });
    if (this.getRevisionDetailError) throw this.getRevisionDetailError;
    return this.getRevisionDetailResult;
  }

  async createExhibitDraft(dto: CreateExhibitDto, user: AuthUser): Promise<ExhibitAdminResponse> {
    this.createExhibitDraftCalls.push({ dto, user });
    if (this.createExhibitDraftError) throw this.createExhibitDraftError;
    return this.createExhibitDraftResult;
  }

  async updateExhibitDraft(
    id: string,
    dto: UpdateExhibitDto,
    user: AuthUser,
  ): Promise<ExhibitAdminResponse> {
    this.updateExhibitDraftCalls.push({ id, dto, user });
    if (this.updateExhibitDraftError) throw this.updateExhibitDraftError;
    return this.updateExhibitDraftResult;
  }

  async submitDraftForReview(id: string): Promise<ExhibitAdminResponse> {
    this.submitDraftForReviewCalls.push(id);
    if (this.submitDraftForReviewError) throw this.submitDraftForReviewError;
    return this.submitDraftForReviewResult;
  }

  async deleteExhibitDraft(id: string): Promise<{ success: boolean; message: string }> {
    this.deleteExhibitDraftCalls.push(id);
    if (this.deleteExhibitDraftError) throw this.deleteExhibitDraftError;
    return this.deleteExhibitDraftResult;
  }

  async deleteDraftRevision(
    id: string,
    revId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.deleteDraftRevisionCalls.push({ id, revId });
    if (this.deleteDraftRevisionError) throw this.deleteDraftRevisionError;
    return this.deleteDraftRevisionResult;
  }

  async reorderExhibits(
    roomId: string,
    exhibitIds: string[],
  ): Promise<{ success: boolean; message: string }> {
    this.reorderExhibitsCalls.push({ roomId, exhibitIds });
    if (this.reorderExhibitsError) throw this.reorderExhibitsError;
    return this.reorderExhibitsResult;
  }
}

// =============================================================================
// Test Suite: Tasks 7.4 & 7.5 — AdminExhibitsController Unit Test Suite
// =============================================================================

describe('Task 7.4 & 7.5 — AdminExhibitsController Comprehensive Test Suite (130 Test Cases)', () => {
  const reflector = new Reflector();

  // ===========================================================================
  // SUITE 1: Architecture, Controller Route & Security Decorators Metadata (15 Test Cases)
  // ===========================================================================
  describe('Suite 1: Architecture & Route Metadata Inspection (15 Test Cases)', () => {
    it('TC-C001: Controller class is decorated with route prefix "admin/exhibits"', () => {
      const path = Reflect.getMetadata('path', AdminExhibitsController);
      assert.strictEqual(path, 'admin/exhibits');
    });

    it('TC-C002: Controller class has ApiTags("Admin · Exhibits")', () => {
      const tags = Reflect.getMetadata('swagger/apiUseTags', AdminExhibitsController);
      assert.deepStrictEqual(tags, ['Admin · Exhibits']);
    });

    it('TC-C003: Controller class has ApiBearerAuth enabled', () => {
      const security = Reflect.getMetadata('swagger/apiSecurity', AdminExhibitsController);
      assert.ok(security);
    });

    it('TC-C004: Controller is NOT marked @Public() (protected by JwtAuthGuard)', () => {
      const isPublic = reflector.get(IS_PUBLIC_KEY, AdminExhibitsController);
      assert.strictEqual(isPublic, undefined);
    });

    it('TC-C005: list handler is decorated with @Get("")', () => {
      const path = Reflect.getMetadata('path', AdminExhibitsController.prototype.list);
      const method = Reflect.getMetadata('method', AdminExhibitsController.prototype.list);
      assert.strictEqual(path, '/');
      assert.strictEqual(method, 0); // RequestMethod.GET = 0
    });

    it('TC-C006: getById handler is decorated with @Get(":id")', () => {
      const path = Reflect.getMetadata('path', AdminExhibitsController.prototype.getById);
      const method = Reflect.getMetadata('method', AdminExhibitsController.prototype.getById);
      assert.strictEqual(path, ':id');
      assert.strictEqual(method, 0);
    });

    it('TC-C007: getRevisionsHistory handler is decorated with @Get(":id/revisions")', () => {
      const path = Reflect.getMetadata('path', AdminExhibitsController.prototype.getRevisionsHistory);
      const method = Reflect.getMetadata('method', AdminExhibitsController.prototype.getRevisionsHistory);
      assert.strictEqual(path, ':id/revisions');
      assert.strictEqual(method, 0);
    });

    it('TC-C008: getRevisionDetail handler is decorated with @Get(":id/revisions/:revId")', () => {
      const path = Reflect.getMetadata('path', AdminExhibitsController.prototype.getRevisionDetail);
      const method = Reflect.getMetadata('method', AdminExhibitsController.prototype.getRevisionDetail);
      assert.strictEqual(path, ':id/revisions/:revId');
      assert.strictEqual(method, 0);
    });

    it('TC-C009: create handler is decorated with @Post("") and @HttpCode(201)', () => {
      const path = Reflect.getMetadata('path', AdminExhibitsController.prototype.create);
      const method = Reflect.getMetadata('method', AdminExhibitsController.prototype.create);
      const code = Reflect.getMetadata('__httpCode__', AdminExhibitsController.prototype.create);
      assert.strictEqual(path, '/');
      assert.strictEqual(method, 1); // RequestMethod.POST = 1
      assert.strictEqual(code, HttpStatus.CREATED);
    });

    it('TC-C010: update handler is decorated with @Patch(":id")', () => {
      const path = Reflect.getMetadata('path', AdminExhibitsController.prototype.update);
      const method = Reflect.getMetadata('method', AdminExhibitsController.prototype.update);
      assert.strictEqual(path, ':id');
      assert.strictEqual(method, 4); // RequestMethod.PATCH = 4
    });

    it('TC-C011: submitReview handler is decorated with @Post(":id/submit-review")', () => {
      const path = Reflect.getMetadata('path', AdminExhibitsController.prototype.submitReview);
      const method = Reflect.getMetadata('method', AdminExhibitsController.prototype.submitReview);
      assert.strictEqual(path, ':id/submit-review');
      assert.strictEqual(method, 1);
    });

    it('TC-C012: deleteDraft handler is decorated with @Delete(":id")', () => {
      const path = Reflect.getMetadata('path', AdminExhibitsController.prototype.deleteDraft);
      const method = Reflect.getMetadata('method', AdminExhibitsController.prototype.deleteDraft);
      assert.strictEqual(path, ':id');
      assert.strictEqual(method, 3); // RequestMethod.DELETE = 3
    });

    it('TC-C013: deleteDraftRevision handler is decorated with @Delete(":id/revisions/:revId")', () => {
      const path = Reflect.getMetadata('path', AdminExhibitsController.prototype.deleteDraftRevision);
      const method = Reflect.getMetadata('method', AdminExhibitsController.prototype.deleteDraftRevision);
      assert.strictEqual(path, ':id/revisions/:revId');
      assert.strictEqual(method, 3);
    });

    it('TC-C014: reorder handler is decorated with @Put("rooms/:roomId/reorder")', () => {
      const path = Reflect.getMetadata('path', AdminExhibitsController.prototype.reorder);
      const method = Reflect.getMetadata('method', AdminExhibitsController.prototype.reorder);
      assert.strictEqual(path, 'rooms/:roomId/reorder');
      assert.strictEqual(method, 2); // RequestMethod.PUT = 2
    });

    it('TC-C015: ApiOperation summaries are present on all endpoints', () => {
      const handlers = [
        AdminExhibitsController.prototype.list,
        AdminExhibitsController.prototype.getById,
        AdminExhibitsController.prototype.getPreview,
        AdminExhibitsController.prototype.getRevisionsHistory,
        AdminExhibitsController.prototype.getRevisionDetail,
        AdminExhibitsController.prototype.create,
        AdminExhibitsController.prototype.update,
        AdminExhibitsController.prototype.submitReview,
        AdminExhibitsController.prototype.deleteDraft,
        AdminExhibitsController.prototype.deleteDraftRevision,
        AdminExhibitsController.prototype.reorder,
      ];

      for (const handler of handlers) {
        const op = Reflect.getMetadata('swagger/apiOperation', handler);
        assert.ok(op && op.summary && typeof op.summary === 'string');
      }
    });
  });

  // ===========================================================================
  // SUITE 2: RBAC Permissions Metadata Inspection (10 Test Cases)
  // ===========================================================================
  describe('Suite 2: RBAC Permissions Metadata Inspection (10 Test Cases)', () => {
    it('TC-C016: list requires PERMISSIONS.EXHIBIT_READ', () => {
      const perms = reflector.get(PERMISSIONS_KEY, AdminExhibitsController.prototype.list);
      assert.deepStrictEqual(perms, [PERMISSIONS.EXHIBIT_READ]);
    });

    it('TC-C017: getById requires PERMISSIONS.EXHIBIT_READ', () => {
      const perms = reflector.get(PERMISSIONS_KEY, AdminExhibitsController.prototype.getById);
      assert.deepStrictEqual(perms, [PERMISSIONS.EXHIBIT_READ]);
    });

    it('TC-C018: getRevisionsHistory requires PERMISSIONS.EXHIBIT_READ', () => {
      const perms = reflector.get(PERMISSIONS_KEY, AdminExhibitsController.prototype.getRevisionsHistory);
      assert.deepStrictEqual(perms, [PERMISSIONS.EXHIBIT_READ]);
    });

    it('TC-C019: getRevisionDetail requires PERMISSIONS.EXHIBIT_READ', () => {
      const perms = reflector.get(PERMISSIONS_KEY, AdminExhibitsController.prototype.getRevisionDetail);
      assert.deepStrictEqual(perms, [PERMISSIONS.EXHIBIT_READ]);
    });

    it('TC-C020: create requires PERMISSIONS.EXHIBIT_CREATE', () => {
      const perms = reflector.get(PERMISSIONS_KEY, AdminExhibitsController.prototype.create);
      assert.deepStrictEqual(perms, [PERMISSIONS.EXHIBIT_CREATE]);
    });

    it('TC-C021: update requires PERMISSIONS.EXHIBIT_UPDATE', () => {
      const perms = reflector.get(PERMISSIONS_KEY, AdminExhibitsController.prototype.update);
      assert.deepStrictEqual(perms, [PERMISSIONS.EXHIBIT_UPDATE]);
    });

    it('TC-C022: submitReview requires PERMISSIONS.REVISION_SUBMIT', () => {
      const perms = reflector.get(PERMISSIONS_KEY, AdminExhibitsController.prototype.submitReview);
      assert.deepStrictEqual(perms, [PERMISSIONS.REVISION_SUBMIT]);
    });

    it('TC-C023: deleteDraft requires PERMISSIONS.EXHIBIT_UPDATE', () => {
      const perms = reflector.get(PERMISSIONS_KEY, AdminExhibitsController.prototype.deleteDraft);
      assert.deepStrictEqual(perms, [PERMISSIONS.EXHIBIT_UPDATE]);
    });

    it('TC-C024: deleteDraftRevision requires PERMISSIONS.EXHIBIT_UPDATE', () => {
      const perms = reflector.get(PERMISSIONS_KEY, AdminExhibitsController.prototype.deleteDraftRevision);
      assert.deepStrictEqual(perms, [PERMISSIONS.EXHIBIT_UPDATE]);
    });

    it('TC-C025: reorder requires PERMISSIONS.EXHIBIT_UPDATE', () => {
      const perms = reflector.get(PERMISSIONS_KEY, AdminExhibitsController.prototype.reorder);
      assert.deepStrictEqual(perms, [PERMISSIONS.EXHIBIT_UPDATE]);
    });
  });

  // ===========================================================================
  // SUITE 3: Audit Logging Metadata Inspection (10 Test Cases)
  // ===========================================================================
  describe('Suite 3: Audit Logging Metadata Inspection (10 Test Cases)', () => {
    it('TC-C026: create is decorated with @Audit("exhibit.create", "exhibit")', () => {
      const audit = reflector.get(AUDIT_KEY, AdminExhibitsController.prototype.create);
      assert.deepStrictEqual(audit, { action: 'exhibit.create', resourceType: 'exhibit' });
    });

    it('TC-C027: update is decorated with @Audit("exhibit.update", "exhibit")', () => {
      const audit = reflector.get(AUDIT_KEY, AdminExhibitsController.prototype.update);
      assert.deepStrictEqual(audit, { action: 'exhibit.update', resourceType: 'exhibit' });
    });

    it('TC-C028: submitReview is decorated with @Audit("revision.submit", "revision")', () => {
      const audit = reflector.get(AUDIT_KEY, AdminExhibitsController.prototype.submitReview);
      assert.deepStrictEqual(audit, { action: 'revision.submit', resourceType: 'revision' });
    });

    it('TC-C029: deleteDraft is decorated with @Audit("exhibit.delete", "exhibit")', () => {
      const audit = reflector.get(AUDIT_KEY, AdminExhibitsController.prototype.deleteDraft);
      assert.deepStrictEqual(audit, { action: 'exhibit.delete', resourceType: 'exhibit' });
    });

    it('TC-C030: deleteDraftRevision is decorated with @Audit("revision.delete", "revision")', () => {
      const audit = reflector.get(AUDIT_KEY, AdminExhibitsController.prototype.deleteDraftRevision);
      assert.deepStrictEqual(audit, { action: 'revision.delete', resourceType: 'revision' });
    });

    it('TC-C031: reorder is decorated with @Audit("exhibit.reorder", "exhibit")', () => {
      const audit = reflector.get(AUDIT_KEY, AdminExhibitsController.prototype.reorder);
      assert.deepStrictEqual(audit, { action: 'exhibit.reorder', resourceType: 'exhibit' });
    });

    it('TC-C032: list is not decorated with @Audit (read-only)', () => {
      const audit = reflector.get(AUDIT_KEY, AdminExhibitsController.prototype.list);
      assert.strictEqual(audit, undefined);
    });

    it('TC-C033: getById is not decorated with @Audit (read-only)', () => {
      const audit = reflector.get(AUDIT_KEY, AdminExhibitsController.prototype.getById);
      assert.strictEqual(audit, undefined);
    });

    it('TC-C034: getRevisionsHistory is not decorated with @Audit (read-only)', () => {
      const audit = reflector.get(AUDIT_KEY, AdminExhibitsController.prototype.getRevisionsHistory);
      assert.strictEqual(audit, undefined);
    });

    it('TC-C035: getRevisionDetail is not decorated with @Audit (read-only)', () => {
      const audit = reflector.get(AUDIT_KEY, AdminExhibitsController.prototype.getRevisionDetail);
      assert.strictEqual(audit, undefined);
    });
  });

  // ===========================================================================
  // SUITE 4: ReorderExhibitsDto Validation Rules (15 Test Cases)
  // ===========================================================================
  describe('Suite 4: ReorderExhibitsDto Validation Rules (15 Test Cases)', () => {
    it('TC-C036: Single valid UUID passes validation', async () => {
      const dto = plainToInstance(ReorderExhibitsDto, {
        exhibitIds: ['123e4567-e89b-12d3-a456-426614174000'],
      });
      const errors = await validate(dto);
      assert.strictEqual(errors.length, 0);
    });

    it('TC-C037: Multiple valid UUIDs pass validation', async () => {
      const dto = plainToInstance(ReorderExhibitsDto, {
        exhibitIds: [
          '123e4567-e89b-12d3-a456-426614174000',
          '223e4567-e89b-12d3-a456-426614174001',
          '323e4567-e89b-12d3-a456-426614174002',
        ],
      });
      const errors = await validate(dto);
      assert.strictEqual(errors.length, 0);
    });

    it('TC-C038: 20 valid UUIDs pass validation', async () => {
      const ids = Array.from({ length: 20 }, (_, i) =>
        `00000000-0000-4000-a000-${String(i).padStart(12, '0')}`,
      );
      const dto = plainToInstance(ReorderExhibitsDto, { exhibitIds: ids });
      const errors = await validate(dto);
      assert.strictEqual(errors.length, 0);
    });

    it('TC-C039: Missing exhibitIds field fails validation', async () => {
      const dto = plainToInstance(ReorderExhibitsDto, {});
      const errors = await validate(dto);
      assert.ok(errors.length > 0);
      assert.strictEqual(errors[0].property, 'exhibitIds');
    });

    it('TC-C040: Null exhibitIds fails validation', async () => {
      const dto = plainToInstance(ReorderExhibitsDto, { exhibitIds: null });
      const errors = await validate(dto);
      assert.ok(errors.length > 0);
    });

    it('TC-C041: Non-array string for exhibitIds fails IsArray', async () => {
      const dto = plainToInstance(ReorderExhibitsDto, { exhibitIds: 'invalid-string' });
      const errors = await validate(dto);
      assert.ok(errors.length > 0);
      assert.ok(errors[0].constraints?.isArray);
    });

    it('TC-C042: Non-array number for exhibitIds fails IsArray', async () => {
      const dto = plainToInstance(ReorderExhibitsDto, { exhibitIds: 12345 });
      const errors = await validate(dto);
      assert.ok(errors.length > 0);
      assert.ok(errors[0].constraints?.isArray);
    });

    it('TC-C043: Non-array object for exhibitIds fails IsArray', async () => {
      const dto = plainToInstance(ReorderExhibitsDto, { exhibitIds: { id: 'uuid' } });
      const errors = await validate(dto);
      assert.ok(errors.length > 0);
      assert.ok(errors[0].constraints?.isArray);
    });

    it('TC-C044: Empty array [] fails ArrayNotEmpty', async () => {
      const dto = plainToInstance(ReorderExhibitsDto, { exhibitIds: [] });
      const errors = await validate(dto);
      assert.ok(errors.length > 0);
      assert.ok(errors[0].constraints?.arrayNotEmpty);
    });

    it('TC-C045: Array containing invalid UUID string fails IsUUID', async () => {
      const dto = plainToInstance(ReorderExhibitsDto, {
        exhibitIds: ['not-a-valid-uuid'],
      });
      const errors = await validate(dto);
      assert.ok(errors.length > 0);
      assert.ok(errors[0].constraints?.isUuid);
    });

    it('TC-C046: Array containing partial UUID fails IsUUID', async () => {
      const dto = plainToInstance(ReorderExhibitsDto, {
        exhibitIds: ['123e4567-e89b-12d3'],
      });
      const errors = await validate(dto);
      assert.ok(errors.length > 0);
      assert.ok(errors[0].constraints?.isUuid);
    });

    it('TC-C047: Array containing non-string number item fails IsUUID', async () => {
      const dto = plainToInstance(ReorderExhibitsDto, {
        exhibitIds: [123456],
      });
      const errors = await validate(dto);
      assert.ok(errors.length > 0);
      assert.ok(errors[0].constraints?.isUuid);
    });

    it('TC-C048: Array containing null item fails IsUUID', async () => {
      const dto = plainToInstance(ReorderExhibitsDto, {
        exhibitIds: [null],
      });
      const errors = await validate(dto);
      assert.ok(errors.length > 0);
      assert.ok(errors[0].constraints?.isUuid);
    });

    it('TC-C049: Array containing mixture of valid and invalid UUID fails validation', async () => {
      const dto = plainToInstance(ReorderExhibitsDto, {
        exhibitIds: ['123e4567-e89b-12d3-a456-426614174000', 'invalid-uuid-2'],
      });
      const errors = await validate(dto);
      assert.ok(errors.length > 0);
      assert.ok(errors[0].constraints?.isUuid);
    });

    it('TC-C050: Validation error message informs in Vietnamese', async () => {
      const dto = plainToInstance(ReorderExhibitsDto, { exhibitIds: [] });
      const errors = await validate(dto);
      assert.strictEqual(errors[0].constraints?.arrayNotEmpty, 'exhibitIds không được để trống');
    });
  });

  // ===========================================================================
  // SUITE 5: list Endpoint Execution & Query Forwarding (10 Test Cases)
  // ===========================================================================
  describe('Suite 5: list Endpoint Execution & Query Forwarding (10 Test Cases)', () => {
    it('TC-C051: list forwards query directly to ExhibitsService.searchAdminExhibits', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const query = new ListExhibitsQueryDto();

      await controller.list(query);
      assert.strictEqual(mockService.searchAdminExhibitsCalls.length, 1);
      assert.strictEqual(mockService.searchAdminExhibitsCalls[0], query);
    });

    it('TC-C052: list forwards query with roomId filter', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const query = Object.assign(new ListExhibitsQueryDto(), {
        roomId: 'r1b50c18-971c-4b68-b39f-f5cf171a8123',
      });

      await controller.list(query);
      assert.strictEqual(mockService.searchAdminExhibitsCalls[0].roomId, 'r1b50c18-971c-4b68-b39f-f5cf171a8123');
    });

    it('TC-C053: list forwards query with status filter ("draft")', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const query = Object.assign(new ListExhibitsQueryDto(), { status: 'draft' as const });

      await controller.list(query);
      assert.strictEqual(mockService.searchAdminExhibitsCalls[0].status, 'draft');
    });

    it('TC-C054: list forwards query with search keyword', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const query = Object.assign(new ListExhibitsQueryDto(), { q: 'Trống đồng' });

      await controller.list(query);
      assert.strictEqual(mockService.searchAdminExhibitsCalls[0].q, 'Trống đồng');
    });

    it('TC-C055: list forwards query with pagination parameters (page: 3, pageSize: 50)', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const query = Object.assign(new ListExhibitsQueryDto(), { page: 3, pageSize: 50 });

      await controller.list(query);
      assert.strictEqual(mockService.searchAdminExhibitsCalls[0].page, 3);
      assert.strictEqual(mockService.searchAdminExhibitsCalls[0].pageSize, 50);
    });

    it('TC-C056: list forwards query with sorting parameters (sort: "createdAt:desc")', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const query = Object.assign(new ListExhibitsQueryDto(), { sort: 'createdAt:desc' });

      await controller.list(query);
      assert.strictEqual(mockService.searchAdminExhibitsCalls[0].sort, 'createdAt:desc');
    });

    it('TC-C057: list returns paginated items and total count from service', async () => {
      const mockService = new MockExhibitsService();
      const sample = createMockExhibitAdminResponse({ id: 'ex-001' });
      mockService.searchAdminExhibitsResult = {
        items: [sample],
        total: 10,
        page: 1,
        pageSize: 1,
      };
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      const res = await controller.list(new ListExhibitsQueryDto());
      assert.strictEqual(res.total, 10);
      assert.strictEqual(res.items.length, 1);
      assert.strictEqual(res.items[0].id, 'ex-001');
    });

    it('TC-C058: list returns empty items list when service returns empty page', async () => {
      const mockService = new MockExhibitsService();
      mockService.searchAdminExhibitsResult = { items: [], total: 0, page: 1, pageSize: 20 };
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      const res = await controller.list(new ListExhibitsQueryDto());
      assert.strictEqual(res.total, 0);
      assert.strictEqual(res.items.length, 0);
    });

    it('TC-C059: list propagates service error when search fails', async () => {
      const mockService = new MockExhibitsService();
      mockService.searchAdminExhibitsError = new BadRequestException('Lỗi tham số truy vấn');
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.list(new ListExhibitsQueryDto()), (err: Error) => {
        assert.ok(err instanceof BadRequestException);
        assert.strictEqual(err.message, 'Lỗi tham số truy vấn');
        return true;
      });
    });

    it('TC-C060: list propagates database disconnection error', async () => {
      const mockService = new MockExhibitsService();
      mockService.searchAdminExhibitsError = new Error('Database connection lost');
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.list(new ListExhibitsQueryDto()), (err: Error) => {
        assert.strictEqual(err.message, 'Database connection lost');
        return true;
      });
    });
  });

  // ===========================================================================
  // SUITE 6: getById Endpoint Execution & Admin Detail Delegation (10 Test Cases)
  // ===========================================================================
  describe('Suite 6: getById Endpoint Execution & Admin Detail Delegation (10 Test Cases)', () => {
    it('TC-C061: getById passes exhibit UUID to ExhibitsService.getAdminDetail', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const id = 'e4b50c18-971c-4b68-b39f-f5cf171a8123';

      await controller.getById(id);
      assert.strictEqual(mockService.getAdminDetailCalls.length, 1);
      assert.strictEqual(mockService.getAdminDetailCalls[0], id);
    });

    it('TC-C062: getById returns complete ExhibitAdminDetailResponse', async () => {
      const mockService = new MockExhibitsService();
      const expected = createMockExhibitAdminDetailResponse({ id: 'detail-ex-1' });
      mockService.getAdminDetailResult = expected;
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      const res = await controller.getById('detail-ex-1');
      assert.strictEqual(res.id, 'detail-ex-1');
      assert.strictEqual(res.version, expected.version);
    });

    it('TC-C063: getById response includes room metadata', async () => {
      const mockService = new MockExhibitsService();
      mockService.getAdminDetailResult = createMockExhibitAdminDetailResponse({
        room: { id: 'room-1', name: 'Phòng Cổ Vật', slug: 'phong-co-vat' },
      });
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      const res = await controller.getById('some-id');
      assert.strictEqual(res.room?.name, 'Phòng Cổ Vật');
      assert.strictEqual(res.room?.slug, 'phong-co-vat');
    });

    it('TC-C064: getById response includes hotspots array', async () => {
      const mockService = new MockExhibitsService();
      mockService.getAdminDetailResult = createMockExhibitAdminDetailResponse({
        hotspots: [
          {
            id: 'h-1',
            label: { vi: 'Họa tiết' },
            body: { vi: 'Chi tiết' },
            position: { x: 0, y: 1, z: 0 },
            displayOrder: 1,
          },
        ],
      });
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      const res = await controller.getById('some-id');
      assert.strictEqual(res.hotspots.length, 1);
      assert.strictEqual(res.hotspots[0].id, 'h-1');
    });

    it('TC-C065: getById response includes revisions list', async () => {
      const mockService = new MockExhibitsService();
      mockService.getAdminDetailResult = createMockExhibitAdminDetailResponse({
        revisions: [
          {
            id: 'rev-1',
            revisionNo: 1,
            state: RevisionState.DRAFT,
            createdById: 'u-1',
            createdBy: null,
            reviewedById: null,
            reviewedBy: null,
            reason: null,
            createdAt: new Date(),
            reviewedAt: null,
          },
        ],
      });
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      const res = await controller.getById('some-id');
      assert.strictEqual(res.revisions.length, 1);
      assert.strictEqual(res.revisions[0].id, 'rev-1');
    });

    it('TC-C066: getById propagates NotFoundException when exhibit does not exist', async () => {
      const mockService = new MockExhibitsService();
      mockService.getAdminDetailError = new NotFoundException('Không tìm thấy hiện vật');
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.getById('non-existent-id'), (err: Error) => {
        assert.ok(err instanceof NotFoundException);
        assert.strictEqual(err.message, 'Không tìm thấy hiện vật');
        return true;
      });
    });

    it('TC-C067: getById propagates NotFoundException when exhibit is soft-deleted', async () => {
      const mockService = new MockExhibitsService();
      mockService.getAdminDetailError = new NotFoundException('Hiện vật đã bị xóa');
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.getById('deleted-id'), (err: Error) => {
        assert.ok(err instanceof NotFoundException);
        return true;
      });
    });

    it('TC-C068: getById propagates generic internal error', async () => {
      const mockService = new MockExhibitsService();
      mockService.getAdminDetailError = new Error('Database query failure');
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.getById('any-id'), (err: Error) => {
        assert.strictEqual(err.message, 'Database query failure');
        return true;
      });
    });

    it('TC-C069: getById calls service exactly once', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await controller.getById('target-id');
      assert.strictEqual(mockService.getAdminDetailCalls.length, 1);
    });

    it('TC-C070: getById handles exhibit with null room cleanly', async () => {
      const mockService = new MockExhibitsService();
      mockService.getAdminDetailResult = createMockExhibitAdminDetailResponse({ room: null });
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      const res = await controller.getById('target-id');
      assert.strictEqual(res.room, null);
    });
  });

  // ===========================================================================
  // SUITE 7: getRevisionsHistory & getRevisionDetail Delegation (10 Test Cases)
  // ===========================================================================
  describe('Suite 7: getRevisionsHistory & getRevisionDetail Delegation (10 Test Cases)', () => {
    it('TC-C071: getRevisionsHistory passes exhibit ID to ExhibitsService.getRevisionsHistory', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const id = 'ex-hist-1';

      await controller.getRevisionsHistory(id);
      assert.strictEqual(mockService.getRevisionsHistoryCalls.length, 1);
      assert.strictEqual(mockService.getRevisionsHistoryCalls[0], id);
    });

    it('TC-C072: getRevisionsHistory returns revision entities list', async () => {
      const mockService = new MockExhibitsService();
      const rev1 = createMockRevisionEntity({ id: 'rev-1', revisionNo: 1 });
      const rev2 = createMockRevisionEntity({ id: 'rev-2', revisionNo: 2 });
      mockService.getRevisionsHistoryResult = [rev2, rev1];
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      const res = await controller.getRevisionsHistory('ex-hist-1');
      assert.strictEqual(res.length, 2);
      assert.strictEqual(res[0].id, 'rev-2');
    });

    it('TC-C073: getRevisionsHistory propagates NotFoundException if exhibit not found', async () => {
      const mockService = new MockExhibitsService();
      mockService.getRevisionsHistoryError = new NotFoundException('Exhibit not found');
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.getRevisionsHistory('missing-ex'), (err: Error) => {
        assert.ok(err instanceof NotFoundException);
        return true;
      });
    });

    it('TC-C074: getRevisionsHistory handles exhibit with multiple revisions in descending order', async () => {
      const mockService = new MockExhibitsService();
      mockService.getRevisionsHistoryResult = [
        createMockRevisionEntity({ revisionNo: 3 }),
        createMockRevisionEntity({ revisionNo: 2 }),
        createMockRevisionEntity({ revisionNo: 1 }),
      ];
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      const res = await controller.getRevisionsHistory('ex-1');
      assert.strictEqual(res[0].revisionNo, 3);
      assert.strictEqual(res[2].revisionNo, 1);
    });

    it('TC-C075: getRevisionsHistory handles exhibit with only 1 revision', async () => {
      const mockService = new MockExhibitsService();
      mockService.getRevisionsHistoryResult = [createMockRevisionEntity({ revisionNo: 1 })];
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      const res = await controller.getRevisionsHistory('ex-single');
      assert.strictEqual(res.length, 1);
    });

    it('TC-C076: getRevisionDetail passes both id and revId to ExhibitsService.getRevisionDetail', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const id = 'ex-target';
      const revId = 'rev-target';

      await controller.getRevisionDetail(id, revId);
      assert.strictEqual(mockService.getRevisionDetailCalls.length, 1);
      assert.strictEqual(mockService.getRevisionDetailCalls[0].id, id);
      assert.strictEqual(mockService.getRevisionDetailCalls[0].revId, revId);
    });

    it('TC-C077: getRevisionDetail returns target revision detail', async () => {
      const mockService = new MockExhibitsService();
      const rev = createMockRevisionEntity({ id: 'rev-detail-1', revisionNo: 2 });
      mockService.getRevisionDetailResult = rev;
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      const res = await controller.getRevisionDetail('ex-target', 'rev-detail-1');
      assert.strictEqual(res.id, 'rev-detail-1');
      assert.strictEqual(res.revisionNo, 2);
    });

    it('TC-C078: getRevisionDetail propagates NotFoundException when revision is not found', async () => {
      const mockService = new MockExhibitsService();
      mockService.getRevisionDetailError = new NotFoundException('Không tìm thấy bản ghi revision');
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.getRevisionDetail('ex-target', 'invalid-rev'), (err: Error) => {
        assert.ok(err instanceof NotFoundException);
        assert.strictEqual(err.message, 'Không tìm thấy bản ghi revision');
        return true;
      });
    });

    it('TC-C079: getRevisionDetail propagates NotFoundException when revision belongs to another exhibit', async () => {
      const mockService = new MockExhibitsService();
      mockService.getRevisionDetailError = new NotFoundException('Revision không thuộc hiện vật này');
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.getRevisionDetail('ex-1', 'rev-of-ex-2'), (err: Error) => {
        assert.ok(err instanceof NotFoundException);
        return true;
      });
    });

    it('TC-C080: getRevisionDetail propagates unexpected service exceptions', async () => {
      const mockService = new MockExhibitsService();
      mockService.getRevisionDetailError = new Error('Database unexpected timeout');
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.getRevisionDetail('ex-1', 'rev-1'), (err: Error) => {
        assert.strictEqual(err.message, 'Database unexpected timeout');
        return true;
      });
    });
  });

  // ===========================================================================
  // SUITE 8: create Endpoint Execution & Draft Initialization (10 Test Cases)
  // ===========================================================================
  describe('Suite 8: create Endpoint Execution & Draft Initialization (10 Test Cases)', () => {
    it('TC-C081: create forwards CreateExhibitDto and AuthUser to ExhibitsService.createExhibitDraft', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const dto = new CreateExhibitDto();
      dto.roomId = 'r1b50c18-971c-4b68-b39f-f5cf171a8123';
      const user = createMockAuthUser();

      await controller.create(dto, user);
      assert.strictEqual(mockService.createExhibitDraftCalls.length, 1);
      assert.strictEqual(mockService.createExhibitDraftCalls[0].dto, dto);
      assert.strictEqual(mockService.createExhibitDraftCalls[0].user, user);
    });

    it('TC-C082: create returns newly created exhibit draft with DRAFT state', async () => {
      const mockService = new MockExhibitsService();
      mockService.createExhibitDraftResult = createMockExhibitAdminResponse({
        revisionState: RevisionState.DRAFT,
        currentRevisionNo: 1,
      });
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      const res = await controller.create(new CreateExhibitDto(), createMockAuthUser());
      assert.strictEqual(res.revisionState, RevisionState.DRAFT);
      assert.strictEqual(res.currentRevisionNo, 1);
    });

    it('TC-C083: create passes user identity including admin/editor roles', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const user = createMockAuthUser({ id: 'editor-99', roles: ['editor'] });

      await controller.create(new CreateExhibitDto(), user);
      assert.strictEqual(mockService.createExhibitDraftCalls[0].user.id, 'editor-99');
      assert.deepStrictEqual(mockService.createExhibitDraftCalls[0].user.roles, ['editor']);
    });

    it('TC-C084: create forwards bilingual name and description correctly', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const dto = new CreateExhibitDto();
      dto.roomId = 'r-1';
      dto.name = { vi: 'Bình hoa', en: 'Vase' };
      dto.description = { vi: 'Mô tả chi tiết', en: 'Detailed description' };

      await controller.create(dto, createMockAuthUser());
      assert.deepStrictEqual(mockService.createExhibitDraftCalls[0].dto.name, { vi: 'Bình hoa', en: 'Vase' });
    });

    it('TC-C085: create forwards 3D transform coordinates (position, rotation, scale)', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const dto = new CreateExhibitDto();
      dto.roomId = 'r-1';
      dto.position = { x: 1, y: 2, z: 3 };
      dto.rotation = { x: 0, y: 1.57, z: 0 };
      dto.scale = { x: 2, y: 2, z: 2 };

      await controller.create(dto, createMockAuthUser());
      assert.deepStrictEqual(mockService.createExhibitDraftCalls[0].dto.position, { x: 1, y: 2, z: 3 });
      assert.deepStrictEqual(mockService.createExhibitDraftCalls[0].dto.rotation, { x: 0, y: 1.57, z: 0 });
      assert.deepStrictEqual(mockService.createExhibitDraftCalls[0].dto.scale, { x: 2, y: 2, z: 2 });
    });

    it('TC-C086: create forwards placeholderShape and placeholderColor', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const dto = new CreateExhibitDto();
      dto.roomId = 'r-1';
      dto.placeholderShape = 'cylinder';
      dto.placeholderColor = '#123456';

      await controller.create(dto, createMockAuthUser());
      assert.strictEqual(mockService.createExhibitDraftCalls[0].dto.placeholderShape, 'cylinder');
      assert.strictEqual(mockService.createExhibitDraftCalls[0].dto.placeholderColor, '#123456');
    });

    it('TC-C087: create forwards media IDs (modelId, imageId, audioId)', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const dto = new CreateExhibitDto();
      dto.roomId = 'r-1';
      dto.modelId = 'm-1';
      dto.imageId = 'img-1';
      dto.audioId = 'aud-1';

      await controller.create(dto, createMockAuthUser());
      assert.strictEqual(mockService.createExhibitDraftCalls[0].dto.modelId, 'm-1');
      assert.strictEqual(mockService.createExhibitDraftCalls[0].dto.imageId, 'img-1');
      assert.strictEqual(mockService.createExhibitDraftCalls[0].dto.audioId, 'aud-1');
    });

    it('TC-C088: create forwards hotspots definition', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const dto = new CreateExhibitDto();
      dto.roomId = 'r-1';
      dto.hotspots = [
        {
          label: { vi: 'H1' },
          body: { vi: 'B1' },
          positionX: 0,
          positionY: 0,
          positionZ: 0,
          displayOrder: 1,
        },
      ];

      await controller.create(dto, createMockAuthUser());
      assert.strictEqual(mockService.createExhibitDraftCalls[0].dto.hotspots?.length, 1);
    });

    it('TC-C089: create propagates NotFoundException when target room does not exist', async () => {
      const mockService = new MockExhibitsService();
      mockService.createExhibitDraftError = new NotFoundException('Phòng không tồn tại');
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.create(new CreateExhibitDto(), createMockAuthUser()), (err: Error) => {
        assert.ok(err instanceof NotFoundException);
        assert.strictEqual(err.message, 'Phòng không tồn tại');
        return true;
      });
    });

    it('TC-C090: create propagates BadRequestException on invalid domain payload', async () => {
      const mockService = new MockExhibitsService();
      mockService.createExhibitDraftError = new BadRequestException('Dữ liệu không hợp lệ');
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.create(new CreateExhibitDto(), createMockAuthUser()), (err: Error) => {
        assert.ok(err instanceof BadRequestException);
        return true;
      });
    });
  });

  // ===========================================================================
  // SUITE 9: update Endpoint Execution & BR-21 / BR-26 Edge Cases (10 Test Cases)
  // ===========================================================================
  describe('Suite 9: update Endpoint Execution & BR-21 / BR-26 Edge Cases (10 Test Cases)', () => {
    it('TC-C091: update forwards exhibit ID, UpdateExhibitDto, and AuthUser to service', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const id = 'e4b50c18-971c-4b68-b39f-f5cf171a8123';
      const dto = new UpdateExhibitDto();
      const user = createMockAuthUser();

      await controller.update(id, dto, user);
      assert.strictEqual(mockService.updateExhibitDraftCalls.length, 1);
      assert.strictEqual(mockService.updateExhibitDraftCalls[0].id, id);
      assert.strictEqual(mockService.updateExhibitDraftCalls[0].dto, dto);
      assert.strictEqual(mockService.updateExhibitDraftCalls[0].user, user);
    });

    it('TC-C092: update returns updated exhibit draft when editing existing DRAFT', async () => {
      const mockService = new MockExhibitsService();
      mockService.updateExhibitDraftResult = createMockExhibitAdminResponse({
        revisionState: RevisionState.DRAFT,
        currentRevisionNo: 1,
      });
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      const res = await controller.update('ex-1', new UpdateExhibitDto(), createMockAuthUser());
      assert.strictEqual(res.revisionState, RevisionState.DRAFT);
    });

    it('TC-C093: update BR-21: returns newly forked draft revision when editing PUBLISHED exhibit', async () => {
      const mockService = new MockExhibitsService();
      // Forked: currentRevisionNo = 2, revisionState = DRAFT
      mockService.updateExhibitDraftResult = createMockExhibitAdminResponse({
        currentRevisionNo: 2,
        revisionState: RevisionState.DRAFT,
        publishedRevisionId: 'pub-rev-1',
      });
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      const res = await controller.update('ex-1', new UpdateExhibitDto(), createMockAuthUser());
      assert.strictEqual(res.currentRevisionNo, 2);
      assert.strictEqual(res.revisionState, RevisionState.DRAFT);
      assert.strictEqual(res.publishedRevisionId, 'pub-rev-1');
    });

    it('TC-C094: update resets REJECTED revision state back to DRAFT', async () => {
      const mockService = new MockExhibitsService();
      mockService.updateExhibitDraftResult = createMockExhibitAdminResponse({
        revisionState: RevisionState.DRAFT,
      });
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      const res = await controller.update('ex-1', new UpdateExhibitDto(), createMockAuthUser());
      assert.strictEqual(res.revisionState, RevisionState.DRAFT);
    });

    it('TC-C095: update BR-26: propagates ConflictException (409) when active revision is IN_REVIEW', async () => {
      const mockService = new MockExhibitsService();
      mockService.updateExhibitDraftError = new ConflictException(
        'Hiện vật đang có bản revision trong hàng chờ kiểm duyệt (IN_REVIEW). Không thể chỉnh sửa cho đến khi được duyệt hoặc từ chối.',
      );
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.update('ex-in-review', new UpdateExhibitDto(), createMockAuthUser()), (err: Error) => {
        assert.ok(err instanceof ConflictException);
        assert.ok(err.message.includes('IN_REVIEW'));
        return true;
      });
    });

    it('TC-C096: update propagates NotFoundException when exhibit does not exist', async () => {
      const mockService = new MockExhibitsService();
      mockService.updateExhibitDraftError = new NotFoundException('Không tìm thấy hiện vật');
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.update('missing-id', new UpdateExhibitDto(), createMockAuthUser()), (err: Error) => {
        assert.ok(err instanceof NotFoundException);
        return true;
      });
    });

    it('TC-C097: update forwards partial DTO containing only name', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const dto = new UpdateExhibitDto();
      dto.name = { vi: 'Tên mới' };

      await controller.update('ex-1', dto, createMockAuthUser());
      assert.deepStrictEqual(mockService.updateExhibitDraftCalls[0].dto.name, { vi: 'Tên mới' });
    });

    it('TC-C098: update forwards partial DTO containing only transform', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const dto = new UpdateExhibitDto();
      dto.position = { x: 5, y: 5, z: 5 };

      await controller.update('ex-1', dto, createMockAuthUser());
      assert.deepStrictEqual(mockService.updateExhibitDraftCalls[0].dto.position, { x: 5, y: 5, z: 5 });
    });

    it('TC-C099: update forwards partial DTO containing only hotspots', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const dto = new UpdateExhibitDto();
      dto.hotspots = [];

      await controller.update('ex-1', dto, createMockAuthUser());
      assert.deepStrictEqual(mockService.updateExhibitDraftCalls[0].dto.hotspots, []);
    });

    it('TC-C100: update propagates unexpected database error', async () => {
      const mockService = new MockExhibitsService();
      mockService.updateExhibitDraftError = new Error('Database write lock timeout');
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.update('ex-1', new UpdateExhibitDto(), createMockAuthUser()), (err: Error) => {
        assert.strictEqual(err.message, 'Database write lock timeout');
        return true;
      });
    });
  });

  // ===========================================================================
  // SUITE 10: submitReview Endpoint Execution & Moderation Transitions (10 Test Cases)
  // ===========================================================================
  describe('Suite 10: submitReview Endpoint Execution & Moderation Transitions (10 Test Cases)', () => {
    it('TC-C101: submitReview passes exhibit UUID to ExhibitsService.submitDraftForReview', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const id = 'e4b50c18-971c-4b68-b39f-f5cf171a8123';

      await controller.submitReview(id);
      assert.strictEqual(mockService.submitDraftForReviewCalls.length, 1);
      assert.strictEqual(mockService.submitDraftForReviewCalls[0], id);
    });

    it('TC-C102: submitReview returns exhibit response with revisionState: IN_REVIEW', async () => {
      const mockService = new MockExhibitsService();
      mockService.submitDraftForReviewResult = createMockExhibitAdminResponse({
        revisionState: RevisionState.IN_REVIEW,
      });
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      const res = await controller.submitReview('ex-1');
      assert.strictEqual(res.revisionState, RevisionState.IN_REVIEW);
    });

    it('TC-C103: submitReview propagates NotFoundException when exhibit does not exist', async () => {
      const mockService = new MockExhibitsService();
      mockService.submitDraftForReviewError = new NotFoundException('Không tìm thấy hiện vật');
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.submitReview('missing-ex'), (err: Error) => {
        assert.ok(err instanceof NotFoundException);
        assert.strictEqual(err.message, 'Không tìm thấy hiện vật');
        return true;
      });
    });

    it('TC-C104: submitReview propagates NotFoundException when active revision not found', async () => {
      const mockService = new MockExhibitsService();
      mockService.submitDraftForReviewError = new NotFoundException('Không tìm thấy bản revision khả dụng');
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.submitReview('no-revision-ex'), (err: Error) => {
        assert.ok(err instanceof NotFoundException);
        return true;
      });
    });

    it('TC-C105: submitReview propagates ConflictException (409) when already IN_REVIEW', async () => {
      const mockService = new MockExhibitsService();
      mockService.submitDraftForReviewError = new ConflictException(
        'Bản revision đã được gửi kiểm duyệt trước đó (đang ở trạng thái in_review)',
      );
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.submitReview('ex-already-in-review'), (err: Error) => {
        assert.ok(err instanceof ConflictException);
        assert.ok(err.message.includes('in_review'));
        return true;
      });
    });

    it('TC-C106: submitReview propagates ConflictException (409) when revision is already APPROVED', async () => {
      const mockService = new MockExhibitsService();
      mockService.submitDraftForReviewError = new ConflictException(
        'Bản revision đã được duyệt (approved) trước đó',
      );
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.submitReview('ex-approved'), (err: Error) => {
        assert.ok(err instanceof ConflictException);
        return true;
      });
    });

    it('TC-C107: submitReview propagates BadRequestException when draft is incomplete', async () => {
      const mockService = new MockExhibitsService();
      mockService.submitDraftForReviewError = new BadRequestException('Bản nháp thiếu tên hiện vật tiếng Việt');
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.submitReview('incomplete-draft'), (err: Error) => {
        assert.ok(err instanceof BadRequestException);
        return true;
      });
    });

    it('TC-C108: submitReview allows submitting from REJECTED state', async () => {
      const mockService = new MockExhibitsService();
      mockService.submitDraftForReviewResult = createMockExhibitAdminResponse({
        revisionState: RevisionState.IN_REVIEW,
      });
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      const res = await controller.submitReview('rejected-ex');
      assert.strictEqual(res.revisionState, RevisionState.IN_REVIEW);
    });

    it('TC-C109: submitReview calls service exactly once', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await controller.submitReview('target-submit-id');
      assert.strictEqual(mockService.submitDraftForReviewCalls.length, 1);
    });

    it('TC-C110: submitReview propagates internal database lock failure', async () => {
      const mockService = new MockExhibitsService();
      mockService.submitDraftForReviewError = new Error('Lock timeout');
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.submitReview('target-id'), (err: Error) => {
        assert.strictEqual(err.message, 'Lock timeout');
        return true;
      });
    });
  });

  // ===========================================================================
  // SUITE 11: deleteDraft & deleteDraftRevision Execution & BR-20 Protection (10 Test Cases)
  // ===========================================================================
  describe('Suite 11: deleteDraft & deleteDraftRevision Execution & BR-20 Protection (10 Test Cases)', () => {
    it('TC-C111: deleteDraft passes exhibit UUID to ExhibitsService.deleteExhibitDraft', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const id = 'e4b50c18-971c-4b68-b39f-f5cf171a8123';

      await controller.deleteDraft(id);
      assert.strictEqual(mockService.deleteExhibitDraftCalls.length, 1);
      assert.strictEqual(mockService.deleteExhibitDraftCalls[0], id);
    });

    it('TC-C112: deleteDraft returns success object for pure draft exhibit', async () => {
      const mockService = new MockExhibitsService();
      mockService.deleteExhibitDraftResult = {
        success: true,
        message: 'Đã xóa hoàn toàn bản nháp hiện vật',
      };
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      const res = await controller.deleteDraft('draft-ex-id');
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.message, 'Đã xóa hoàn toàn bản nháp hiện vật');
    });

    it('TC-C113: deleteDraft BR-20 Guard: propagates ConflictException (409) when exhibit is published', async () => {
      const mockService = new MockExhibitsService();
      mockService.deleteExhibitDraftError = new ConflictException(
        'Không thể xóa hiện vật đã từng xuất bản (SRS BR-20). Vui lòng chuyển trạng thái ẩn thay vì xóa.',
      );
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.deleteDraft('published-ex-id'), (err: Error) => {
        assert.ok(err instanceof ConflictException);
        assert.ok(err.message.includes('SRS BR-20'));
        return true;
      });
    });

    it('TC-C114: deleteDraft BR-20 Guard: propagates ConflictException (409) when exhibit is visible', async () => {
      const mockService = new MockExhibitsService();
      mockService.deleteExhibitDraftError = new ConflictException(
        'Hiện vật đang hiển thị công khai (visibility: visible), không thể xóa.',
      );
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.deleteDraft('visible-ex-id'), (err: Error) => {
        assert.ok(err instanceof ConflictException);
        return true;
      });
    });

    it('TC-C115: deleteDraft propagates NotFoundException when exhibit does not exist', async () => {
      const mockService = new MockExhibitsService();
      mockService.deleteExhibitDraftError = new NotFoundException('Không tìm thấy hiện vật');
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.deleteDraft('missing-id'), (err: Error) => {
        assert.ok(err instanceof NotFoundException);
        return true;
      });
    });

    it('TC-C116: deleteDraftRevision passes exhibit ID and revision ID to service', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const id = 'ex-del-rev';
      const revId = 'rev-to-delete';

      await controller.deleteDraftRevision(id, revId);
      assert.strictEqual(mockService.deleteDraftRevisionCalls.length, 1);
      assert.strictEqual(mockService.deleteDraftRevisionCalls[0].id, id);
      assert.strictEqual(mockService.deleteDraftRevisionCalls[0].revId, revId);
    });

    it('TC-C117: deleteDraftRevision returns success response when deleting DRAFT revision', async () => {
      const mockService = new MockExhibitsService();
      mockService.deleteDraftRevisionResult = {
        success: true,
        message: 'Đã xóa bản revision nháp thành công',
      };
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      const res = await controller.deleteDraftRevision('ex-id', 'rev-draft-id');
      assert.strictEqual(res.success, true);
    });

    it('TC-C118: deleteDraftRevision returns success response when deleting REJECTED revision', async () => {
      const mockService = new MockExhibitsService();
      mockService.deleteDraftRevisionResult = {
        success: true,
        message: 'Đã xóa bản revision bị từ chối thành công',
      };
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      const res = await controller.deleteDraftRevision('ex-id', 'rev-rejected-id');
      assert.strictEqual(res.success, true);
    });

    it('TC-C119: deleteDraftRevision propagates ConflictException (409) when revision is published or approved', async () => {
      const mockService = new MockExhibitsService();
      mockService.deleteDraftRevisionError = new ConflictException(
        'Không thể xóa phiên bản đang được xuất bản chính thức hoặc đã approved',
      );
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.deleteDraftRevision('ex-id', 'pub-rev-id'), (err: Error) => {
        assert.ok(err instanceof ConflictException);
        return true;
      });
    });

    it('TC-C120: deleteDraftRevision propagates ConflictException (409) when revision is in moderation (IN_REVIEW)', async () => {
      const mockService = new MockExhibitsService();
      mockService.deleteDraftRevisionError = new ConflictException(
        'Không thể xóa phiên bản đang trong hàng đợi kiểm duyệt (IN_REVIEW)',
      );
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.deleteDraftRevision('ex-id', 'in-review-rev-id'), (err: Error) => {
        assert.ok(err instanceof ConflictException);
        return true;
      });
    });
  });

  // ===========================================================================
  // SUITE 12: reorder Endpoint Execution & Multi-Exhibit Ordering (10 Test Cases)
  // ===========================================================================
  describe('Suite 12: reorder Endpoint Execution & Multi-Exhibit Ordering (10 Test Cases)', () => {
    it('TC-C121: reorder passes roomId and exhibitIds to ExhibitsService.reorderExhibits', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const roomId = 'r1b50c18-971c-4b68-b39f-f5cf171a8123';
      const body: ReorderExhibitsDto = {
        exhibitIds: ['123e4567-e89b-12d3-a456-426614174000', '223e4567-e89b-12d3-a456-426614174001'],
      };

      await controller.reorder(roomId, body);
      assert.strictEqual(mockService.reorderExhibitsCalls.length, 1);
      assert.strictEqual(mockService.reorderExhibitsCalls[0].roomId, roomId);
      assert.deepStrictEqual(mockService.reorderExhibitsCalls[0].exhibitIds, body.exhibitIds);
    });

    it('TC-C122: reorder returns success response { success: true, message: ... }', async () => {
      const mockService = new MockExhibitsService();
      mockService.reorderExhibitsResult = {
        success: true,
        message: 'Đã cập nhật thứ tự 2 hiện vật trong phòng',
      };
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      const res = await controller.reorder('room-1', {
        exhibitIds: ['ex-1', 'ex-2'],
      });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.message, 'Đã cập nhật thứ tự 2 hiện vật trong phòng');
    });

    it('TC-C123: reorder handles single exhibit ID', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await controller.reorder('room-1', { exhibitIds: ['single-ex-id'] });
      assert.strictEqual(mockService.reorderExhibitsCalls[0].exhibitIds.length, 1);
    });

    it('TC-C124: reorder handles multiple exhibits in new sequence order', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const sequence = ['ex-c', 'ex-a', 'ex-b'];

      await controller.reorder('room-1', { exhibitIds: sequence });
      assert.deepStrictEqual(mockService.reorderExhibitsCalls[0].exhibitIds, sequence);
    });

    it('TC-C125: reorder propagates NotFoundException when target room does not exist', async () => {
      const mockService = new MockExhibitsService();
      mockService.reorderExhibitsError = new NotFoundException('Phòng không tồn tại');
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.reorder('missing-room', { exhibitIds: ['ex-1'] }), (err: Error) => {
        assert.ok(err instanceof NotFoundException);
        assert.strictEqual(err.message, 'Phòng không tồn tại');
        return true;
      });
    });

    it('TC-C126: reorder propagates NotFoundException when target room is soft-deleted', async () => {
      const mockService = new MockExhibitsService();
      mockService.reorderExhibitsError = new NotFoundException('Phòng đã bị xóa');
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.reorder('deleted-room', { exhibitIds: ['ex-1'] }), (err: Error) => {
        assert.ok(err instanceof NotFoundException);
        return true;
      });
    });

    it('TC-C127: reorder passes large array of exhibit IDs', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const largeList = Array.from({ length: 50 }, (_, i) => `ex-id-${i}`);

      await controller.reorder('room-1', { exhibitIds: largeList });
      assert.strictEqual(mockService.reorderExhibitsCalls[0].exhibitIds.length, 50);
    });

    it('TC-C128: reorder propagates database transaction deadlock error', async () => {
      const mockService = new MockExhibitsService();
      mockService.reorderExhibitsError = new Error('deadlock detected');
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);

      await assert.rejects(async () => controller.reorder('room-1', { exhibitIds: ['ex-1'] }), (err: Error) => {
        assert.strictEqual(err.message, 'deadlock detected');
        return true;
      });
    });

    it('TC-C129: reorder verifies roomId argument is preserved without mutation', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const originalRoomId = '77777777-7777-4777-a777-777777777777';

      await controller.reorder(originalRoomId, { exhibitIds: ['ex-1'] });
      assert.strictEqual(mockService.reorderExhibitsCalls[0].roomId, originalRoomId);
    });

    it('TC-C130: reorder verifies exhibitIds array preserves its exact given order', async () => {
      const mockService = new MockExhibitsService();
      const controller = new AdminExhibitsController(mockService as unknown as ExhibitsService);
      const ordered = ['id-3', 'id-1', 'id-2'];

      await controller.reorder('room-1', { exhibitIds: ordered });
      assert.strictEqual(mockService.reorderExhibitsCalls[0].exhibitIds[0], 'id-3');
      assert.strictEqual(mockService.reorderExhibitsCalls[0].exhibitIds[1], 'id-1');
      assert.strictEqual(mockService.reorderExhibitsCalls[0].exhibitIds[2], 'id-2');
    });
  });
});
