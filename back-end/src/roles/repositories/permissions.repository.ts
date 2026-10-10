import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Permission } from '../../permissions/permission.entity';
import { RolePermission } from '../../role-permissions/role-permission.entity';

/** Danh mục quyền + quản lý bảng nối role_permissions. */
@Injectable()
export class PermissionsRepository {
  constructor(
    @InjectRepository(Permission)
    private readonly permissions: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissions: Repository<RolePermission>,
  ) {}

  listAll(): Promise<Permission[]> {
    return this.permissions.find({ order: { code: 'ASC' } });
  }

  async findMissingCodes(codes: string[]): Promise<string[]> {
    if (codes.length === 0) return [];
    const found = await this.permissions.find({ where: { code: In(codes) } });
    const foundCodes = new Set(found.map((permission) => permission.code));
    return codes.filter((code) => !foundCodes.has(code));
  }

  /**
   * Đặt lại toàn bộ quyền cho role: xóa liên kết cũ, thêm theo danh sách code mới.
   * Chạy trong transaction để đảm bảo nhất quán.
   */
  async setForRole(roleId: string, codes: string[], manager: EntityManager): Promise<void> {
    const permissionRepo = manager.getRepository(Permission);
    const linkRepo = manager.getRepository(RolePermission);

    await linkRepo.delete({ roleId });
    if (codes.length === 0) return;

    const permissions = await permissionRepo.find({ where: { code: In(codes) } });
    const links = permissions.map((permission) =>
      linkRepo.create({ roleId, permissionId: permission.id }),
    );
    await linkRepo.save(links);
  }
}
