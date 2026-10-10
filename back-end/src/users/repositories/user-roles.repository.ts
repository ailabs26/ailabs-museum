import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Role } from '../../roles/role.entity';
import { UserRole } from '../../user-roles/user-role.entity';

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
  async findMissingRoleIds(roleIds: string[]): Promise<string[]> {
    if (roleIds.length === 0) return [];
    const found = await this.roles.find({ where: { id: In(roleIds) } });
    const foundIds = new Set(found.map((role) => role.id));
    return roleIds.filter((id) => !foundIds.has(id));
  }

  assign(userId: string, roleId: string, manager?: EntityManager): Promise<UserRole> {
    const repo = manager ? manager.getRepository(UserRole) : this.userRoles;
    return repo.save(repo.create({ userId, roleId }));
  }

  async assignMany(userId: string, roleIds: string[], manager: EntityManager): Promise<void> {
    const repo = manager.getRepository(UserRole);
    const rows = roleIds.map((roleId) => repo.create({ userId, roleId }));
    if (rows.length > 0) await repo.save(rows);
  }

  async remove(userId: string, roleId: string): Promise<void> {
    await this.userRoles.delete({ userId, roleId });
  }

  async has(userId: string, roleId: string): Promise<boolean> {
    return (await this.userRoles.count({ where: { userId, roleId } })) > 0;
  }
}
