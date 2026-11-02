import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repository/base.repository';
import { Paginated } from '../../../common/types/paginated.type';
import { Notification } from '../entities/notification.entity';

@Injectable()
export class NotificationsRepository extends BaseRepository<Notification> {
  constructor(@InjectRepository(Notification) repo: Repository<Notification>) {
    super(repo);
  }

  /** Thông báo của user, mới nhất trước. */
  async listForUser(userId: string, page: number, pageSize: number): Promise<Paginated<Notification>> {
    const [items, total] = await this.repo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  countUnread(userId: string): Promise<number> {
    return this.repo.count({ where: { userId, readAt: IsNull() } });
  }

  /** Đánh dấu đã đọc một thông báo của user; false nếu không thuộc user. Đọc rồi thì giữ thời điểm cũ. */
  async markRead(userId: string, id: string): Promise<boolean> {
    const found = await this.repo.exists({ where: { id, userId } });
    if (!found) return false;
    await this.repo.update({ id, userId, readAt: IsNull() }, { readAt: new Date() });
    return true;
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.repo.update({ userId, readAt: IsNull() }, { readAt: new Date() });
    return result.affected ?? 0;
  }

  /** Xóa hẳn một thông báo của user; false nếu không thuộc user. */
  async deleteOwn(userId: string, id: string): Promise<boolean> {
    const result = await this.repo.delete({ id, userId });
    return (result.affected ?? 0) > 0;
  }

  async insertMany(rows: Partial<Notification>[]): Promise<void> {
    if (rows.length > 0) await this.repo.insert(rows);
  }

  /** User đang hoạt động có quyền `permission` qua một vai trò chưa bị xóa. */
  async findRecipientIdsByPermission(permission: string): Promise<string[]> {
    const rows: { id: string }[] = await this.repo.query(
      `SELECT DISTINCT u.id FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id AND r.is_deleted = false
       JOIN role_permissions rp ON rp.role_id = r.id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE p.code = $1 AND u.status = 'active' AND u.is_deleted = false`,
      [permission],
    );
    return rows.map((row) => row.id);
  }
}
