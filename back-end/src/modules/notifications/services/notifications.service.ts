import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { Paginated } from '../../../common/types/paginated.type';
import { primaryText, resolveBilingual } from '../../exhibits/utils/bilingual';
import { Notification, NotificationType } from '../entities/notification.entity';
import { NotificationsRepository } from '../repositories/notifications.repository';

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: Date;
}

const toResponse = (n: Notification): NotificationResponse => ({
  id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, read: n.readAt !== null, createdAt: n.createdAt,
});

/** Cột `title` dài tối đa 200 ký tự; tên hiện vật do người dùng nhập nên phải cắt. */
const clip = (text: string, max = 200) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/**
 * Tên hiển thị của hiện vật từ `content.name` thô: dữ liệu thật có thể là chuỗi, object `{ vi, en }`
 * hoặc chuỗi JSON song ngữ — kiểu khai báo `string` của content không phản ánh đủ.
 */
const exhibitLabel = (raw: unknown): string | null => primaryText(resolveBilingual(raw));
const UNNAMED = 'Hiện vật chưa đặt tên';

const NOT_FOUND = 'Không tìm thấy thông báo';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly repo: NotificationsRepository) {}

  // ---------------------------------------------------------------- Người nhận

  async list(userId: string, page: number, pageSize: number): Promise<Paginated<NotificationResponse>> {
    const result = await this.repo.listForUser(userId, page, pageSize);
    return { ...result, items: result.items.map(toResponse) };
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    return { count: await this.repo.countUnread(userId) };
  }

  async markRead(userId: string, id: string): Promise<void> {
    if (!(await this.repo.markRead(userId, id))) throw new NotFoundException(NOT_FOUND);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    return { updated: await this.repo.markAllRead(userId) };
  }

  async remove(userId: string, id: string): Promise<void> {
    if (!(await this.repo.deleteOwn(userId, id))) throw new NotFoundException(NOT_FOUND);
  }

  // ---------------------------------------------------------------- Phát thông báo
  // Gọi SAU khi thao tác chính đã commit; lỗi chỉ ghi log, không làm hỏng thao tác chính.

  /** Bản nội dung được gửi duyệt → người có quyền duyệt (trừ chính người gửi). */
  revisionSubmitted(input: { exhibitName: unknown; actorId: string }): Promise<void> {
    return this.safely(NotificationType.REVISION_SUBMITTED, async () => {
      const recipients = await this.repo.findRecipientIdsByPermission(PERMISSIONS.REVISION_PUBLISH);
      return recipients.filter((id) => id !== input.actorId).map((userId) => ({
        userId,
        type: NotificationType.REVISION_SUBMITTED,
        title: clip(`Bản nội dung mới chờ duyệt: ${exhibitLabel(input.exhibitName) ?? UNNAMED}`),
        body: null,
        link: '/admin/moderation',
      }));
    });
  }

  /** Bản nội dung được duyệt / bị từ chối → tác giả (trừ khi tác giả tự duyệt). */
  revisionReviewed(input: {
    approved: boolean; exhibitName: unknown; authorId: string; reviewerId: string; reason?: string | null;
  }): Promise<void> {
    return this.safely(input.approved ? NotificationType.REVISION_APPROVED : NotificationType.REVISION_REJECTED, async () => {
      if (input.authorId === input.reviewerId) return [];
      return [{
        userId: input.authorId,
        type: input.approved ? NotificationType.REVISION_APPROVED : NotificationType.REVISION_REJECTED,
        title: clip(input.approved
          ? `Bản nội dung đã được duyệt: ${exhibitLabel(input.exhibitName) ?? UNNAMED}`
          : `Bản nội dung bị từ chối: ${exhibitLabel(input.exhibitName) ?? UNNAMED}`),
        body: input.approved ? null : (input.reason ?? null),
        link: '/admin/exhibits',
      }];
    });
  }

  /** Khách gửi báo cáo vi phạm → người có quyền xử lý báo cáo. */
  reportCreated(input: { exhibitName: unknown; message: string }): Promise<void> {
    return this.safely(NotificationType.REPORT_CREATED, async () => {
      const recipients = await this.repo.findRecipientIdsByPermission(PERMISSIONS.REPORT_RESOLVE);
      const name = exhibitLabel(input.exhibitName);
      return recipients.map((userId) => ({
        userId,
        type: NotificationType.REPORT_CREATED,
        title: clip(name ? `Báo cáo vi phạm mới về ${name}` : 'Báo cáo vi phạm mới'),
        body: input.message,
        link: '/admin/reports',
      }));
    });
  }

  private async safely(type: NotificationType, build: () => Promise<Partial<Notification>[]>): Promise<void> {
    try {
      await this.repo.insertMany(await build());
    } catch (error) {
      this.logger.warn(JSON.stringify({ type, message: 'Không tạo được thông báo', error: String(error) }));
    }
  }
}
