import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, QueryFailedError, Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repository/base.repository';
import { Role } from '../entities/role.entity';

@Injectable()
export class RolesRepository extends BaseRepository<Role> {
  constructor(@InjectRepository(Role) repo: Repository<Role>) {
    super(repo);
  }

  /** Mọi truy vấn vai trò chỉ thấy vai trò chưa xóa mềm. */
  override findById(id: string, relations: string[] = []): Promise<Role | null> {
    return this.repo.findOne({ where: { id, isDeleted: false }, relations });
  }

  findByCode(code: string): Promise<Role | null> {
    return this.repo.findOne({ where: { code, isDeleted: false } });
  }

  existsByCode(code: string): Promise<boolean> {
    return this.exists({ code, isDeleted: false });
  }

  /** Danh sách vai trò kèm quyền; `deleted` → thùng rác, mới xóa trước. */
  listWithPermissions(deleted = false): Promise<Role[]> {
    return this.repo.find({
      where: { isDeleted: deleted },
      relations: ['rolePermissions', 'rolePermissions.permission'],
      order: deleted ? { deletedAt: 'DESC', id: 'DESC' } : { code: 'ASC' },
    });
  }

  findWithPermissions(id: string): Promise<Role | null> {
    return this.repo.findOne({
      where: { id, isDeleted: false },
      relations: ['rolePermissions', 'rolePermissions.permission'],
    });
  }

  findManyByIds(ids: string[], manager: EntityManager): Promise<Role[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return manager.getRepository(Role).find({ where: { id: In(ids), isDeleted: false } });
  }

  /** Khóa dòng các vai trò chưa xóa (chặn gán vai trò đồng thời qua FK user_roles → roles). */
  lockActiveByIds(ids: string[], manager: EntityManager): Promise<Role[]> {
    return manager.getRepository(Role).find({
      where: { id: In(ids), isDeleted: false },
      lock: { mode: 'pessimistic_write' },
    });
  }

  /** Số người dùng (chưa xóa mềm) đang được gán từng vai trò; user đã xóa vẫn giữ dòng user_roles nên phải loại ra. */
  async countAssignments(ids: string[], manager: EntityManager): Promise<Map<string, number>> {
    const rows: Array<{ roleId: string; count: number }> = await manager.query(
      `SELECT ur.role_id AS "roleId", COUNT(*)::int AS count
         FROM user_roles ur JOIN users u ON u.id = ur.user_id
        WHERE ur.role_id = ANY($1) AND u.is_deleted = false
        GROUP BY ur.role_id`,
      [ids],
    );
    return new Map(rows.map((row) => [row.roleId, row.count]));
  }

  async markDeleted(ids: string[], manager: EntityManager): Promise<void> {
    await manager.getRepository(Role).update({ id: In(ids) }, { isDeleted: true, deletedAt: new Date() });
  }

  /** Khóa dòng các vai trò đang trong thùng rác (đã xóa mềm) để khôi phục. */
  lockDeletedByIds(ids: string[], manager: EntityManager): Promise<Role[]> {
    return manager.getRepository(Role).find({
      where: { id: In(ids), isDeleted: true },
      lock: { mode: 'pessimistic_write' },
    });
  }

  /** Vai trò chưa xóa đang giữ các mã này (mã chỉ unique giữa các vai trò chưa xóa). */
  findActiveByCodes(codes: string[], manager: EntityManager): Promise<Role[]> {
    if (codes.length === 0) return Promise.resolve([]);
    return manager.getRepository(Role).find({ where: { code: In(codes), isDeleted: false } });
  }

  async markRestored(ids: string[], manager: EntityManager): Promise<void> {
    await manager.getRepository(Role).update({ id: In(ids) }, { isDeleted: false, deletedAt: null });
  }

  /** Vi phạm unique mã giữa các vai trò chưa xóa (vd vai trò cùng mã vừa được tạo song song). */
  isActiveCodeConflict(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driver = error.driverError as { code?: string; constraint?: string };
    return driver.code === '23505' && driver.constraint === 'UQ_roles_code_active';
  }
}
