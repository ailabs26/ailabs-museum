import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { RoleKey } from '../../../common/enums/role.enum';
import { Permission } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { UserRole } from '../../users/entities/user-role.entity';
import { CreateRoleDto } from '../dto/create-role.dto';
import { RoleResponse, toRoleResponse } from '../dto/role-response.dto';
import { SetPermissionsDto } from '../dto/set-permissions.dto';
import {
  RolePermissionUpdateDto,
  SetPermissionMatrixDto,
} from '../dto/set-permission-matrix.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { Role } from '../entities/role.entity';
import { PermissionsRepository } from '../repositories/permissions.repository';
import { RolesRepository } from '../repositories/roles.repository';

/** Role hệ thống mặc định — không cho xóa. */
const SYSTEM_ROLE_CODES = new Set<string>(Object.values(RoleKey));
const PROTECTED_PERMISSION_ROLE_CODE = RoleKey.ADMIN;

export interface PermissionMatrixResponse {
  roleIds: string[];
  roles: RoleResponse[];
}

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
    const role = await this.requireRole(id);
    this.assertPermissionsAreEditable(role);
    await this.tx.run(async (manager) => {
      await this.permissions.lockMatrix(manager);
      await this.validatePermissionCodes(dto.permissions, manager);
      await this.permissions.setForRole(id, dto.permissions, manager);
    });
    return toRoleResponse(await this.requireWithPermissions(id));
  }

  async setPermissionMatrix(dto: SetPermissionMatrixDto): Promise<PermissionMatrixResponse> {
    const roleIds = dto.updates.map((update) => update.roleId);
    if (new Set(roleIds).size !== roleIds.length) {
      throw new UnprocessableEntityException('Mỗi vai trò chỉ được xuất hiện một lần');
    }

    await this.tx.run(async (manager) => {
      await this.permissions.lockMatrix(manager);
      const roles = await this.roles.findManyByIds(roleIds, manager);
      const rolesById = new Map(roles.map((role) => [role.id, role]));
      const missingRoleIds = roleIds.filter((roleId) => !rolesById.has(roleId));
      if (missingRoleIds.length > 0) {
        throw new UnprocessableEntityException(
          `Vai trò không tồn tại: ${missingRoleIds.join(', ')}`,
        );
      }

      for (const role of roles) this.assertPermissionsAreEditable(role);
      const permissionCodes = [...new Set(dto.updates.flatMap((update) => update.permissions))];
      await this.validatePermissionCodes(permissionCodes, manager);
      for (const update of dto.updates) {
        await this.setRolePermissions(update, manager);
      }
    });

    const roles = await Promise.all(roleIds.map((roleId) => this.requireWithPermissions(roleId)));
    return { roleIds, roles: roles.map(toRoleResponse) };
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

  private assertPermissionsAreEditable(role: Role): void {
    if (role.code === PROTECTED_PERMISSION_ROLE_CODE) {
      throw new ConflictException('Không thể thay đổi quyền của vai trò Admin hệ thống');
    }
  }

  private async validatePermissionCodes(
    codes: string[],
    manager?: import('typeorm').EntityManager,
  ): Promise<void> {
    const missing = await this.permissions.findMissingCodes(codes, manager);
    if (missing.length > 0) {
      throw new UnprocessableEntityException(`Quyền không tồn tại: ${missing.join(', ')}`);
    }
  }

  private setRolePermissions(
    update: RolePermissionUpdateDto,
    manager: import('typeorm').EntityManager,
  ): Promise<void> {
    return this.permissions.setForRole(update.roleId, update.permissions, manager);
  }
}
