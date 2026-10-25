import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { PermissionDeniedException } from '../../../common/exceptions/permission-denied.exception';
import { RoleKey } from '../../../common/enums/role.enum';
import type { AuthUser } from '../../../common/types/auth-user.type';
import type { Paginated } from '../../../common/types/paginated.type';
import { PasswordService } from '../../../common/security/password.service';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { RefreshSessionsRepository } from '../../auth/repositories/refresh-sessions.repository';
import { CreateUserDto } from '../dto/create-user.dto';
import { ListUsersQueryDto } from '../dto/list-users-query.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { toUserResponse, type UserResponse } from '../dto/user-response.dto';
import { User, UserStatus } from '../entities/user.entity';
import { UserRolesRepository } from '../repositories/user-roles.repository';
import { UsersRepository } from '../repositories/users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly userRoles: UserRolesRepository,
    private readonly passwords: PasswordService,
    private readonly tx: TransactionManager,
    private readonly sessions: RefreshSessionsRepository,
  ) {}

  async list(query: ListUsersQueryDto): Promise<Paginated<UserResponse>> {
    const page = await this.users.listPaginated(query);
    return { ...page, items: page.items.map(toUserResponse) };
  }

  async getById(id: string): Promise<UserResponse> {
    return toUserResponse(await this.requireDetail(id));
  }

  async create(dto: CreateUserDto, actor: AuthUser): Promise<UserResponse> {
    if (dto.roleIds?.length) this.requireRoleAssignment(actor);
    if (await this.users.existsByEmail(dto.email)) {
      throw new ConflictException('Email đã được sử dụng, kể cả tài khoản đã xóa');
    }
    const passwordHash = await this.passwords.hash(dto.password);
    return this.tx.run(async (manager) => {
      await this.users.lockManagement(manager);
      await this.ensureRolesExist(dto.roleIds ?? [], manager);
      const saved = await this.users.saveNew(this.users.create({
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
      }), manager);
      await this.userRoles.assignMany(saved.id, dto.roleIds ?? [], manager);
      return toUserResponse(await this.requireDetail(saved.id, manager));
    });
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser): Promise<UserResponse> {
    if (dto.roleIds !== undefined) this.requireRoleAssignment(actor);
    const patch: Partial<User> = {};
    if (dto.displayName !== undefined) patch.displayName = dto.displayName;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.password !== undefined) patch.passwordHash = await this.passwords.hash(dto.password);

    return this.tx.run(async (manager) => {
      await this.users.lockManagement(manager);
      const current = await this.requireDetail(id, manager);
      const nextCodes = dto.roleIds === undefined
        ? toUserResponse(current).roles
        : await this.validateRoleCodes(dto.roleIds, manager);
      await this.ensureAdminRemains(current, dto.status ?? current.status, nextCodes, manager);
      if (Object.keys(patch).length) await this.users.update(id, patch, manager);
      if (dto.roleIds !== undefined) await this.userRoles.replace(id, dto.roleIds, manager);
      // Đổi mật khẩu hoặc khóa → đăng xuất mọi thiết bị ngay, cùng transaction.
      if (dto.password !== undefined || dto.status === UserStatus.DISABLED) {
        await this.sessions.revokeAllForUser(id, manager);
      }
      return toUserResponse(await this.requireDetail(id, manager));
    });
  }

  async remove(id: string): Promise<void> {
    await this.tx.run(async (manager) => {
      await this.users.lockManagement(manager);
      const current = await this.requireDetail(id, manager);
      await this.ensureAdminRemains(current, UserStatus.DISABLED, [], manager);
      await this.users.update(id, { isDeleted: true, deletedAt: new Date() }, manager);
      await this.sessions.revokeAllForUser(id, manager);
    });
  }

  async assignRoles(id: string, roleIds: string[]): Promise<UserResponse> {
    return this.tx.run(async (manager) => {
      await this.users.lockManagement(manager);
      await this.requireDetail(id, manager);
      await this.ensureRolesExist(roleIds, manager);
      await this.userRoles.assignMany(id, roleIds, manager);
      return toUserResponse(await this.requireDetail(id, manager));
    });
  }

  async setRoles(id: string, roleIds: string[]): Promise<UserResponse> {
    return this.tx.run(async (manager) => {
      await this.users.lockManagement(manager);
      const current = await this.requireDetail(id, manager);
      const codes = await this.validateRoleCodes(roleIds, manager);
      await this.ensureAdminRemains(current, current.status, codes, manager);
      await this.userRoles.replace(id, roleIds, manager);
      return toUserResponse(await this.requireDetail(id, manager));
    });
  }

  async removeRole(id: string, roleId: string): Promise<UserResponse> {
    return this.tx.run(async (manager) => {
      await this.users.lockManagement(manager);
      const current = await this.requireDetail(id, manager);
      const nextCodes = (current.userRoles ?? [])
        .filter((row) => row.roleId !== roleId)
        .map((row) => row.role.code);
      await this.ensureAdminRemains(current, current.status, nextCodes, manager);
      await this.userRoles.remove(id, roleId, manager);
      return toUserResponse(await this.requireDetail(id, manager));
    });
  }

  private requireRoleAssignment(actor: AuthUser): void {
    if (!actor.permissions.includes(PERMISSIONS.ROLE_ASSIGN)) {
      throw new PermissionDeniedException(
        [PERMISSIONS.ROLE_ASSIGN],
        [PERMISSIONS.ROLE_ASSIGN],
      );
    }
  }

  private async ensureAdminRemains(
    current: User,
    nextStatus: UserStatus,
    nextCodes: string[],
    manager: EntityManager,
  ): Promise<void> {
    const isActiveAdmin = current.status === UserStatus.ACTIVE
      && toUserResponse(current).roles.includes(RoleKey.ADMIN);
    const remainsAdmin = nextStatus === UserStatus.ACTIVE && nextCodes.includes(RoleKey.ADMIN);
    if (isActiveAdmin && !remainsAdmin && await this.users.countActiveAdmins(manager) <= 1) {
      throw new ConflictException('Không thể khóa, xóa hoặc bỏ vai trò của Admin hoạt động cuối cùng');
    }
  }

  private async ensureRolesExist(roleIds: string[], manager: EntityManager): Promise<void> {
    const missing = await this.userRoles.findMissingRoleIds(roleIds, manager);
    if (missing.length) {
      throw new UnprocessableEntityException(`Vai trò không tồn tại: ${missing.join(', ')}`);
    }
  }

  private async validateRoleCodes(roleIds: string[], manager: EntityManager): Promise<string[]> {
    await this.ensureRolesExist(roleIds, manager);
    return this.userRoles.findCodes(roleIds, manager);
  }

  private async requireDetail(id: string, manager?: EntityManager): Promise<User> {
    const user = await this.users.findDetail(id, manager);
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return user;
  }
}
