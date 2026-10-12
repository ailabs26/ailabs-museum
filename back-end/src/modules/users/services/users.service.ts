import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Paginated } from '../../../common/types/paginated.type';
import { PasswordService } from '../../../common/security/password.service';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { CreateUserDto } from '../dto/create-user.dto';
import { ListUsersQueryDto } from '../dto/list-users-query.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { toUserResponse, UserResponse } from '../dto/user-response.dto';
import { User } from '../entities/user.entity';
import { UserRolesRepository } from '../repositories/user-roles.repository';
import { UsersRepository } from '../repositories/users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly userRoles: UserRolesRepository,
    private readonly passwords: PasswordService,
    private readonly tx: TransactionManager,
  ) {}

  async list(query: ListUsersQueryDto): Promise<Paginated<UserResponse>> {
    const page = await this.users.listPaginated({
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      status: query.status,
    });
    return { ...page, items: page.items.map(toUserResponse) };
  }

  async getById(id: string): Promise<UserResponse> {
    return toUserResponse(await this.requireDetail(id));
  }

  async create(dto: CreateUserDto): Promise<UserResponse> {
    if (await this.users.existsByEmail(dto.email)) {
      throw new ConflictException('Email đã được sử dụng');
    }
    await this.ensureRolesExist(dto.roleIds ?? []);

    const passwordHash = await this.passwords.hash(dto.password);
    const created = await this.tx.run(async (manager) => {
      const saved = (await this.users.save(
        this.users.create({
          email: dto.email,
          passwordHash,
          displayName: dto.displayName,
        }),
        manager,
      )) as User;
      await this.userRoles.assignMany(saved.id, dto.roleIds ?? [], manager);
      return saved;
    });

    return toUserResponse(await this.requireDetail(created.id));
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponse> {
    await this.requireActive(id);
    const patch: Partial<User> = {};
    if (dto.displayName !== undefined) patch.displayName = dto.displayName;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.password !== undefined) {
      patch.passwordHash = await this.passwords.hash(dto.password);
    }
    if (Object.keys(patch).length > 0) {
      await this.users.update(id, patch);
    }
    return toUserResponse(await this.requireDetail(id));
  }

  async remove(id: string): Promise<void> {
    await this.requireActive(id);
    // Entity dùng cột deletedAt tường minh (không phải @DeleteDateColumn); phải set
    // cả is_deleted lẫn deleted_at để thỏa CHECK (is_deleted = deleted_at IS NOT NULL).
    await this.users.update(id, { isDeleted: true, deletedAt: new Date() });
  }

  async assignRoles(id: string, roleIds: string[]): Promise<UserResponse> {
    await this.requireActive(id);
    await this.ensureRolesExist(roleIds);
    for (const roleId of roleIds) {
      if (!(await this.userRoles.has(id, roleId))) {
        await this.userRoles.assign(id, roleId);
      }
    }
    return toUserResponse(await this.requireDetail(id));
  }

  async removeRole(id: string, roleId: string): Promise<UserResponse> {
    await this.requireActive(id);
    await this.userRoles.remove(id, roleId);
    return toUserResponse(await this.requireDetail(id));
  }

  private async ensureRolesExist(roleIds: string[]): Promise<void> {
    const missing = await this.userRoles.findMissingRoleIds(roleIds);
    if (missing.length > 0) {
      throw new UnprocessableEntityException(`Vai trò không tồn tại: ${missing.join(', ')}`);
    }
  }

  private async requireActive(id: string): Promise<User> {
    const user = await this.users.findActiveById(id);
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return user;
  }

  private async requireDetail(id: string): Promise<User> {
    const user = await this.users.findDetail(id);
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return user;
  }
}
