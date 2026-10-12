import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../../../common/types/auth-user.type';
import {
  ContentReport,
  ContentReportStatus,
} from '../entities/content-report.entity';
import { ContentReportsRepository } from '../repositories/content-reports.repository';
import { ContentReportsService } from '../services/content-reports.service';

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
}): ContentReportsRepository {
  return {
    findDetail: () => Promise.resolve(opts.report ?? null),
    exhibitExists: () => Promise.resolve(opts.exhibitExists ?? true),
    create: (data: Partial<ContentReport>) => sampleReport(data),
    save: (report: ContentReport) => Promise.resolve(report),
  } as unknown as ContentReportsRepository;
}

describe('ContentReportsService.create', () => {
  it('ném 404 khi hiện vật không tồn tại', async () => {
    const svc = new ContentReportsService(fakeRepo({ exhibitExists: false }));
    await assert.rejects(
      () => svc.create({ exhibitId: 'x', category: 'c', message: 'm' }),
      NotFoundException,
    );
  });

  it('tạo báo cáo trạng thái open', async () => {
    const svc = new ContentReportsService(fakeRepo({ exhibitExists: true }));
    const res = await svc.create({ exhibitId: 'e', category: 'wrong_info', message: 'm' });
    assert.equal(res.status, ContentReportStatus.OPEN);
  });
});

describe('ContentReportsService.assign', () => {
  it('ném 409 khi báo cáo không ở trạng thái open', async () => {
    const svc = new ContentReportsService(
      fakeRepo({ report: sampleReport({ status: ContentReportStatus.RESOLVED }) }),
    );
    await assert.rejects(() => svc.assign('c', ACTOR), ConflictException);
  });

  it('chuyển open → in_progress và gán actor', async () => {
    const svc = new ContentReportsService(fakeRepo({ report: sampleReport() }));
    const res = await svc.assign('c', ACTOR);
    assert.equal(res.status, ContentReportStatus.IN_PROGRESS);
    assert.equal(res.assignedTo, null); // relation chưa nạp trong mock, chỉ set assignedToId
  });
});

describe('ContentReportsService.resolve/dismiss', () => {
  it('resolve thành công khi còn mở', async () => {
    const svc = new ContentReportsService(
      fakeRepo({ report: sampleReport({ status: ContentReportStatus.IN_PROGRESS }) }),
    );
    const res = await svc.resolve('c', { resolution: 'Đã sửa' }, ACTOR);
    assert.equal(res.status, ContentReportStatus.RESOLVED);
    assert.equal(res.resolution, 'Đã sửa');
    assert.ok(res.resolvedAt);
  });

  it('ném 409 khi đóng báo cáo đã đóng', async () => {
    const svc = new ContentReportsService(
      fakeRepo({ report: sampleReport({ status: ContentReportStatus.DISMISSED }) }),
    );
    await assert.rejects(
      () => svc.dismiss('c', { resolution: 'x' }, ACTOR),
      ConflictException,
    );
  });
});

describe('ContentReportsService.get', () => {
  it('ném 404 khi không tìm thấy', async () => {
    const svc = new ContentReportsService(fakeRepo({ report: null }));
    await assert.rejects(() => svc.get('c'), NotFoundException);
  });
});
