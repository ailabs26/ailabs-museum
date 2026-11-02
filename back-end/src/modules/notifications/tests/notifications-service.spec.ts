import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { Notification, NotificationType } from '../entities/notification.entity';
import type { NotificationsRepository } from '../repositories/notifications.repository';
import { NotificationsService } from '../services/notifications.service';

/** Repo giả: người có quyền theo bảng `holders`, ghi lại thông báo đã chèn. */
function harness(holders: Record<string, string[]> = {}, options: { failInsert?: boolean; owned?: boolean } = {}) {
  const inserted: Partial<Notification>[] = [];
  const repo = {
    findRecipientIdsByPermission: async (permission: string) => holders[permission] ?? [],
    insertMany: async (rows: Partial<Notification>[]) => {
      if (options.failInsert) throw new Error('db down');
      inserted.push(...rows);
    },
    markRead: async () => options.owned ?? true,
    deleteOwn: async () => options.owned ?? true,
    markAllRead: async () => 3,
    countUnread: async () => 2,
    listForUser: async (_u: string, page: number, pageSize: number) => ({
      items: [{ id: 'n1', type: NotificationType.REPORT_CREATED, title: 't', body: 'b', link: '/x', readAt: null,
        createdAt: new Date('2026-11-02T00:00:00Z') } as Notification,
      { id: 'n2', type: NotificationType.REVISION_APPROVED, title: 't2', body: null, link: null, readAt: new Date(),
        createdAt: new Date('2026-11-01T00:00:00Z') } as Notification],
      total: 2, page, pageSize,
    }),
  } as unknown as NotificationsRepository;
  return { service: new NotificationsService(repo), inserted };
}

describe('NotificationsService — người nhận', () => {
  it('list trả cờ read thay vì readAt, giữ phân trang', async () => {
    const page = await harness().service.list('u', 2, 10);
    assert.deepEqual(page.items.map((n) => [n.id, n.read]), [['n1', false], ['n2', true]]);
    assert.equal(page.page, 2);
    assert.equal(page.pageSize, 10);
    assert.equal('readAt' in page.items[0], false);
  });

  it('đọc / xóa thông báo không thuộc mình → 404', async () => {
    const { service } = harness({}, { owned: false });
    await assert.rejects(service.markRead('u', 'x'), NotFoundException);
    await assert.rejects(service.remove('u', 'x'), NotFoundException);
  });

  it('unreadCount và markAllRead bọc kết quả', async () => {
    const { service } = harness();
    assert.deepEqual(await service.unreadCount('u'), { count: 2 });
    assert.deepEqual(await service.markAllRead('u'), { updated: 3 });
  });
});

describe('NotificationsService — phát thông báo', () => {
  it('gửi duyệt → mọi người có revision:publish, trừ chính người gửi; link trang Kiểm duyệt', async () => {
    const { service, inserted } = harness({ [PERMISSIONS.REVISION_PUBLISH]: ['mod-1', 'mod-2', 'actor'] });
    await service.revisionSubmitted({ exhibitName: 'Trống đồng', actorId: 'actor' });
    assert.deepEqual(inserted.map((n) => n.userId), ['mod-1', 'mod-2']);
    assert.equal(inserted[0].type, NotificationType.REVISION_SUBMITTED);
    assert.equal(inserted[0].title, 'Bản nội dung mới chờ duyệt: Trống đồng');
    assert.equal(inserted[0].link, '/admin/moderation');
  });

  it('bị từ chối → tác giả nhận kèm lý do trong body; được duyệt → không body', async () => {
    const { service, inserted } = harness();
    await service.revisionReviewed({ approved: false, exhibitName: 'Mũ', authorId: 'a', reviewerId: 'r', reason: 'Thiếu nguồn' });
    await service.revisionReviewed({ approved: true, exhibitName: 'Mũ', authorId: 'a', reviewerId: 'r' });
    assert.deepEqual(inserted.map((n) => [n.userId, n.type, n.title, n.body]), [
      ['a', NotificationType.REVISION_REJECTED, 'Bản nội dung bị từ chối: Mũ', 'Thiếu nguồn'],
      ['a', NotificationType.REVISION_APPROVED, 'Bản nội dung đã được duyệt: Mũ', null],
    ]);
  });

  it('tác giả tự duyệt bản của mình → không thông báo', async () => {
    const { service, inserted } = harness();
    await service.revisionReviewed({ approved: true, exhibitName: 'Mũ', authorId: 'same', reviewerId: 'same' });
    assert.deepEqual(inserted, []);
  });

  it('báo cáo mới → người có report:resolve, body là nội dung báo cáo; thiếu tên hiện vật vẫn có tiêu đề', async () => {
    const { service, inserted } = harness({ [PERMISSIONS.REPORT_RESOLVE]: ['h1'] });
    await service.reportCreated({ exhibitName: 'La bàn', message: 'Niên đại sai' });
    await service.reportCreated({ exhibitName: null, message: 'x' });
    assert.deepEqual(inserted.map((n) => [n.userId, n.title, n.body, n.link]), [
      ['h1', 'Báo cáo vi phạm mới về La bàn', 'Niên đại sai', '/admin/reports'],
      ['h1', 'Báo cáo vi phạm mới', 'x', '/admin/reports'],
    ]);
  });

  it('tên song ngữ thật ({ vi, en }, chuỗi JSON, chỉ en, rỗng) → lấy tiếng Việt, thiếu thì tiếng Anh, không "[object Object]"', async () => {
    const { service, inserted } = harness({ [PERMISSIONS.REVISION_PUBLISH]: ['m'], [PERMISSIONS.REPORT_RESOLVE]: ['h'] });
    await service.revisionSubmitted({ exhibitName: { vi: 'Trống đồng', en: 'Bronze drum' }, actorId: 'x' });
    await service.revisionReviewed({ approved: true, exhibitName: '{"vi":null,"en":"Compass"}', authorId: 'a', reviewerId: 'r' });
    await service.reportCreated({ exhibitName: { vi: '', en: '' }, message: 'm' });
    await service.revisionSubmitted({ exhibitName: undefined, actorId: 'x' });
    assert.deepEqual(inserted.map((n) => n.title), [
      'Bản nội dung mới chờ duyệt: Trống đồng',
      'Bản nội dung đã được duyệt: Compass',
      'Báo cáo vi phạm mới',
      'Bản nội dung mới chờ duyệt: Hiện vật chưa đặt tên',
    ]);
  });

  it('tên hiện vật rất dài → tiêu đề cắt còn 200 ký tự (giới hạn cột)', async () => {
    const { service, inserted } = harness({ [PERMISSIONS.REVISION_PUBLISH]: ['m'] });
    await service.revisionSubmitted({ exhibitName: 'A'.repeat(500), actorId: 'x' });
    assert.equal(inserted[0].title!.length, 200);
    assert.ok(inserted[0].title!.endsWith('…'));
  });

  it('lỗi ghi thông báo không làm hỏng thao tác chính', async () => {
    const { service } = harness({ [PERMISSIONS.REPORT_RESOLVE]: ['h1'] }, { failInsert: true });
    await assert.doesNotReject(service.reportCreated({ exhibitName: 'x', message: 'm' }));
  });
});
