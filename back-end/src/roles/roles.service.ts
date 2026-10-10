import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TransactionManager } from '../core/database/transaction.manager';
import { RoleKey } from '../common/enums/role.enum';
import { Permission } from '../permissions/permission.entity';
import { RolePermission } from '../role-permissions/role-permission.entity';
import { UserRole } from '../user-roles/user-role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { RoleResponse, toRoleResponse } from './dto/role-response.dto';
import { SetPermissionsDto } from './dto/set-permissions.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role } from './role.entity';
import { PermissionsRepository } from './repositories/permissions.repository';
import { RolesRepository } from './repositories/roles.repository';

/** Role hệ thống mặc định — không cho xóa. */
const SYSTEM_ROLE_CODES = new Set<string>(Object.values(RoleKey));

@Injectable()
export class RolesService {
  constructor(
    private readonly roles: RolesRepository,
    private readonly permissions: PermissionsRepository,
    private readonly tx: TransactionManager,
  ) {}

  async list(): Promise<RoleResponse[]> {
    return (await this.roles.listWithPermissions()).map(toRoleResponse);
  }

  async getById(id: string): Promise<RoleResponse> {
    return toRoleResponse(await this.requireWithPermissions(id));
  }

  async create(dto: CreateRoleDto): Promise<RoleResponse> {
    if (await this.roles.existsByCode(dto.code)) {
      throw new ConflictException('Code vai trò đã tồn tại');
    }
    const saved = (await this.roles.save(
      this.roles.create({ code: dto.code, name: dto.name }),
    )) as Role;
    return toRoleResponse(await this.requireWithPermissions(saved.id));
  }

  async update(id: string, dto: UpdateRoleDto): Promise<RoleResponse> {
    await this.requireRole(id);
    await this.roles.update(id, { name: dto.name });
    return toRoleResponse(await this.requireWithPermissions(id));
  }

  async remove(id: string): Promise<void> {
    const role = await this.requireRole(id);
    if (SYSTEM_ROLE_CODES.has(role.code)) {
      throw new ConflictException('Không thể xóa vai trò hệ thống mặc định');
    }
    await this.tx.run(async (manager) => {
      const inUse = await manager.getRepository(UserRole).count({ where: { roleId: id } });
      if (inUse > 0) {
        throw new ConflictException('Vai trò đang được gán cho người dùng');
      }
      await manager.getRepository(RolePermission).delete({ roleId: id });
      await manager.getRepository(Role).delete({ id });
    });
  }

  async getPermissions(id: string): Promise<string[]> {
    return toRoleResponse(await this.requireWithPermissions(id)).permissions;
  }

  async setPermissions(id: string, dto: SetPermissionsDto): Promise<RoleResponse> {
    await this.requireRole(id);
    const missing = await this.permissions.findMissingCodes(dto.permissions);
    if (missing.length > 0) {
      throw new UnprocessableEntityException(`Quyền không tồn tại: ${missing.join(', ')}`);
    }
    await this.tx.run((manager) => this.permissions.setForRole(id, dto.permissions, manager));
    return toRoleResponse(await this.requireWithPermissions(id));
  }

  async listAllPermissions(): Promise<Permission[]> {
    return this.permissions.listAll();
  }

  private async requireRole(id: string): Promise<Role> {
    const role = await this.roles.findById(id);
    if (!role) throw new NotFoundException('Không tìm thấy vai trò');
    return role;
  }

  private async requireWithPermissions(id: string): Promise<Role> {
    const role = await this.roles.findWithPermissions(id);
    if (!role) throw new NotFoundException('Không tìm thấy vai trò');
    return role;
  }
}
