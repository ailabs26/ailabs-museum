import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
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

  listWithPermissions(): Promise<Role[]> {
    return this.repo.find({
      where: { isDeleted: false },
      relations: ['rolePermissions', 'rolePermissions.permission'],
      order: { code: 'ASC' },
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
}
