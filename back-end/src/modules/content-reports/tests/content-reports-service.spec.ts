import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../../../common/types/auth-user.type';
import {
  ContentReport,
  ContentReportStatus,
} from '../entities/content-report.entity';
import { ContentReportsRepository } from '../repositories/content-reports.repository';
import { ContentReportsService } from '../services/content-reports.service';
import { PublicReportCategory } from '../dto/create-report.dto';
import { notificationsStub } from '../../notifications/tests/notifications.stub';
import type { UserBrief, UsersRepository } from '../../users/repositories/users.repository';

const ACTOR: AuthUser = {
  id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  email: 'admin@aura.local',
  displayName: 'Admin',
  roles: ['admin'],
  permissions: [],
};

function sampleReport(overrides?: Partial<ContentReport>): ContentReport {
  const r = new ContentReport();
  r.id = overrides?.id ?? 'c1111111-1111-4111-1111-111111111111';
  r.exhibitId = overrides?.exhibitId ?? 'e1111111-1111-4111-1111-111111111111';
  r.reportedRevisionId = overrides?.reportedRevisionId ?? null;
  r.category = overrides?.category ?? 'wrong_info';
  r.message = overrides?.message ?? 'Sai niên đại';
  r.status = overrides?.status ?? ContentReportStatus.OPEN;
  r.assignedToId = overrides?.assignedToId ?? null;
  r.resolution = overrides?.resolution ?? null;
  r.createdAt = overrides?.createdAt ?? new Date('2026-10-10T00:00:00Z');
  r.resolvedAt = overrides?.resolvedAt ?? null;
  return r;
}

function fakeRepo(opts: {
  report?: ContentReport | null;
  exhibitExists?: boolean;
  revisionBelongsToExhibit?: boolean;
  onCreate?: (data: Partial<ContentReport>) => void;
}): ContentReportsRepository {
  return {
    findDetail: () => Promise.resolve(opts.report ?? null),
    exhibitExists: () => Promise.resolve(opts.exhibitExists ?? true),
    revisionBelongsToExhibit: () => Promise.resolve(opts.revisionBelongsToExhibit ?? true),
    create: (data: Partial<ContentReport>) => { opts.onCreate?.(data); return sampleReport(data); },
    save: (report: ContentReport) => Promise.resolve(report),
    exhibitName: () => Promise.resolve('Trống đồng'),
  } as unknown as ContentReportsRepository;
}

/** UsersRepository giả: danh sách người có quyền xử lý báo cáo. */
function fakeUsers(holders: UserBrief[] = []): UsersRepository {
  return { findActiveWithPermission: () => Promise.resolve(holders) } as unknown as UsersRepository;
}

describe('ContentReportsService.create', () => {
  it('ném 404 khi hiện vật không tồn tại', async () => {
    let createCalls = 0;
    const svc = new ContentReportsService(fakeRepo({ exhibitExists: false, onCreate: () => { createCalls++; } }), notificationsStub(), fakeUsers());
    await assert.rejects(
      () => svc.create({ exhibitId: 'x', category: PublicReportCategory.OTHER, message: 'm' }),
      NotFoundException,
    );
    assert.equal(createCalls, 0);
  });

  it('tạo báo cáo trạng thái open → báo người xử lý kèm tên hiện vật và nội dung', async () => {
    let created: Partial<ContentReport> | undefined;
    const notifier = notificationsStub();
    const svc = new ContentReportsService(fakeRepo({ exhibitExists: true, onCreate: (data) => { created = data; } }), notifier, fakeUsers());
    const res = await svc.create({ exhibitId: 'e', reportedRevisionId: 'r', category: PublicReportCategory.WRONG_INFO, message: 'm' });
    assert.equal(res.status, ContentReportStatus.OPEN);
    assert.equal(created?.reportedRevisionId, 'r');
    assert.deepEqual(notifier.calls, [{ method: 'reportCreated', input: { exhibitName: 'Trống đồng', message: 'm' } }]);
  });

  it('từ chối revision không thuộc hiện vật được báo cáo', async () => {
    const svc = new ContentReportsService(fakeRepo({ revisionBelongsToExhibit: false }), notificationsStub(), fakeUsers());
    await assert.rejects(
      () => svc.create({ exhibitId: 'e', reportedRevisionId: 'r', category: PublicReportCategory.WRONG_INFO, message: 'm' }),
      BadRequestException,
    );
  });
});

describe('ContentReportsService.assign', () => {
  const OTHER: UserBrief = { id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', email: 'mod@aura.local', displayName: 'Kiểm duyệt viên' };

  function setup(report = sampleReport(), holders: UserBrief[] = [OTHER]) {
    const notifier = notificationsStub();
    let saves = 0;
    const repo = Object.assign(fakeRepo({ report }), {
      save: (r: ContentReport) => { saves++; return Promise.resolve(r); },
    });
    return { svc: new ContentReportsService(repo, notifier, fakeUsers(holders)), notifier, saves: () => saves };
  }

  it('ném 409 khi báo cáo đã đóng', async () => {
    const { svc, saves } = setup(sampleReport({ status: ContentReportStatus.RESOLVED }));
    await assert.rejects(() => svc.assign('c', ACTOR), ConflictException);
    assert.equal(saves(), 0);
  });

  it('tự tiếp nhận: open → in_progress, phản hồi hiện đúng người nhận (không còn null)', async () => {
    const { svc, notifier } = setup();
    const res = await svc.assign('c', ACTOR);
    assert.equal(res.status, ContentReportStatus.IN_PROGRESS);
    assert.deepEqual(res.assignedTo, { id: ACTOR.id, email: ACTOR.email, displayName: ACTOR.displayName });
    // Service thông báo bỏ qua khi người giao = người nhận (kiểm ở notifications-service.spec).
    assert.equal((notifier.calls[0].input as { assigneeId: string }).assigneeId, ACTOR.id);
  });

  it('giao cho người có quyền → gán người đó và báo cho họ kèm tên người giao + nội dung báo cáo', async () => {
    const { svc, notifier } = setup();
    const res = await svc.assign('c', ACTOR, OTHER.id);
    assert.equal(res.status, ContentReportStatus.IN_PROGRESS);
    assert.deepEqual(res.assignedTo, OTHER);
    assert.deepEqual(notifier.calls, [{ method: 'reportAssigned', input: {
      assigneeId: OTHER.id, actorId: ACTOR.id, actorName: ACTOR.displayName, exhibitName: 'Trống đồng', message: sampleReport().message,
    } }]);
  });

  it('giao cho người không có quyền xử lý báo cáo / không tồn tại → 400, không lưu, không báo', async () => {
    const { svc, notifier, saves } = setup(sampleReport(), []);
    await assert.rejects(() => svc.assign('c', ACTOR, OTHER.id), BadRequestException);
    assert.equal(saves(), 0);
    assert.deepEqual(notifier.calls, []);
  });

  it('giao lại khi đang xử lý cho người khác → được; giao lại đúng người đang giữ → 409', async () => {
    const inProgress = () => sampleReport({ status: ContentReportStatus.IN_PROGRESS, assignedToId: ACTOR.id });
    const reassign = setup(inProgress());
    assert.deepEqual((await reassign.svc.assign('c', ACTOR, OTHER.id)).assignedTo, OTHER);

    const same = setup(inProgress());
    await assert.rejects(() => same.svc.assign('c', ACTOR), ConflictException);
    assert.equal(same.saves(), 0);
  });
});

describe('ContentReportsService.resolve/dismiss', () => {
  it('resolve thành công khi còn mở', async () => {
    const svc = new ContentReportsService(
      fakeRepo({ report: sampleReport({ status: ContentReportStatus.IN_PROGRESS }) }),
      notificationsStub(),
      fakeUsers(),
    );
    const res = await svc.resolve('c', { resolution: 'Đã sửa' }, ACTOR);
    assert.equal(res.status, ContentReportStatus.RESOLVED);
    assert.equal(res.resolution, 'Đã sửa');
    assert.ok(res.resolvedAt);
  });

  it('ném 409 khi đóng báo cáo đã đóng', async () => {
    const svc = new ContentReportsService(
      fakeRepo({ report: sampleReport({ status: ContentReportStatus.DISMISSED }) }),
      notificationsStub(),
      fakeUsers(),
    );
    await assert.rejects(
      () => svc.dismiss('c', { resolution: 'x' }, ACTOR),
      ConflictException,
    );
  });
});

describe('ContentReportsService.get', () => {
  it('ném 404 khi không tìm thấy', async () => {
    const svc = new ContentReportsService(fakeRepo({ report: null }), notificationsStub(), fakeUsers());
    await assert.rejects(() => svc.get('c'), NotFoundException);
  });
});
