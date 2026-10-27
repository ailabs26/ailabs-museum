import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { UserRole } from '../entities/user-role.entity';

/** Thao tác trên bảng nối user_roles + kiểm tra role tồn tại. */
@Injectable()
export class UserRolesRepository {
  constructor(
    @InjectRepository(UserRole)
    private readonly userRoles: Repository<UserRole>,
    @InjectRepository(Role)
    private readonly roles: Repository<Role>,
  ) {}

  /** Lọc ra các roleId không tồn tại (để báo lỗi 422). */
  async findMissingRoleIds(roleIds: string[], manager?: EntityManager): Promise<string[]> {
    if (roleIds.length === 0) return [];
    const repository = manager ? manager.getRepository(Role) : this.roles;
    const found = await repository.find({ where: { id: In(roleIds), isDeleted: false } });
    const foundIds = new Set(found.map((role) => role.id));
    return roleIds.filter((id) => !foundIds.has(id));
  }

  async findCodes(roleIds: string[], manager: EntityManager): Promise<string[]> {
    if (roleIds.length === 0) return [];
    const roles = await manager.getRepository(Role).find({ where: { id: In(roleIds), isDeleted: false } });
    return roles.map((role) => role.code);
  }

  assign(userId: string, roleId: string, manager?: EntityManager): Promise<UserRole> {
    const repo = manager ? manager.getRepository(UserRole) : this.userRoles;
    return repo.save(repo.create({ userId, roleId }));
  }

  async assignMany(userId: string, roleIds: string[], manager: EntityManager): Promise<void> {
    const repo = manager.getRepository(UserRole);
    const current = await repo.find({ where: { userId } });
    const assignedIds = new Set(current.map((row) => row.roleId));
    const rows = roleIds.filter((roleId) => !assignedIds.has(roleId))
      .map((roleId) => repo.create({ userId, roleId }));
    if (rows.length > 0) await repo.save(rows);
  }

  async replace(userId: string, roleIds: string[], manager: EntityManager): Promise<void> {
    const repo = manager.getRepository(UserRole);
    const current = await repo.find({ where: { userId } });
    const next = new Set(roleIds);
    const removedIds = current.filter((row) => !next.has(row.roleId)).map((row) => row.roleId);
    if (removedIds.length > 0) await repo.delete({ userId, roleId: In(removedIds) });
    await this.assignMany(userId, roleIds, manager);
  }

  async remove(userId: string, roleId: string, manager: EntityManager): Promise<void> {
    await manager.getRepository(UserRole).delete({ userId, roleId });
  }

  async has(userId: string, roleId: string): Promise<boolean> {
    return (await this.userRoles.count({ where: { userId, roleId } })) > 0;
  }
}
