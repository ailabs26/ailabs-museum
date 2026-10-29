import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, In, QueryFailedError, Repository } from 'typeorm';
import { RoleKey } from '../../../common/enums/role.enum';
import { Paginated } from '../../../common/types/paginated.type';
import { BaseRepository } from '../../../common/repository/base.repository';
import { User, UserStatus } from '../entities/user.entity';

export interface ListUsersOptions {
  page: number;
  pageSize: number;
  q?: string;
  status?: UserStatus;
  /** true: chỉ tài khoản đã xóa mềm (thùng rác). */
  deleted?: boolean;
}

/** Quan hệ cần nạp để dựng AuthUser (roles + permissions gộp). */
const ACCESS_RELATIONS = [
  'userRoles',
  'userRoles.role',
  'userRoles.role.rolePermissions',
  'userRoles.role.rolePermissions.permission',
];

@Injectable()
export class UsersRepository extends BaseRepository<User> {
  constructor(@InjectRepository(User) repo: Repository<User>) {
    super(repo);
  }

  /** Nạp user kèm role + permission để đăng nhập / dựng token. */
  findByEmailWithAccess(email: string): Promise<User | null> {
    return this.repo.findOne({
      where: { email, isDeleted: false },
      relations: ACCESS_RELATIONS,
    });
  }

  findByIdWithAccess(id: string, manager?: EntityManager): Promise<User | null> {
    const repository = manager ? manager.getRepository(User) : this.repo;
    return repository.findOne({
      where: { id, isDeleted: false },
      relations: ACCESS_RELATIONS,
    });
  }

  findActiveById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id, isDeleted: false } });
  }

  /** Nạp user kèm role (cho response), không nạp permission. */
  findDetail(id: string, manager?: EntityManager): Promise<User | null> {
    return this.scoped(manager).findOne({
      where: { id, isDeleted: false },
      relations: ['userRoles', 'userRoles.role'],
    });
  }

  existsByEmail(email: string): Promise<boolean> {
    // Email unique toàn bảng, gồm cả tài khoản đã xóa mềm.
    return this.exists({ email });
  }

  async saveNew(user: User, manager: EntityManager): Promise<User> {
    try {
      return await this.scoped(manager).save(user);
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as { code?: string; constraint?: string };
        const emailConstraint = this.repo.metadata.uniques.find((unique) =>
          unique.columns.length === 1 && unique.columns[0].propertyName === 'email');
        if (driverError.code === '23505' && driverError.constraint === emailConstraint?.name) {
          throw new ConflictException('Email đã được sử dụng, kể cả tài khoản đã xóa');
        }
      }
      throw error;
    }
  }

  /** Khóa dòng các tài khoản đang trong thùng rác (đã xóa mềm) để khôi phục. */
  lockDeletedByIds(ids: string[], manager: EntityManager): Promise<User[]> {
    return this.scoped(manager).find({
      where: { id: In(ids), isDeleted: true },
      lock: { mode: 'pessimistic_write' },
    });
  }

  async markRestored(ids: string[], manager: EntityManager): Promise<void> {
    await this.scoped(manager).update({ id: In(ids) }, { isDeleted: false, deletedAt: null });
  }

  /** Tuần tự hóa các thay đổi tài khoản/Role để bảo vệ Admin cuối cùng. */
  async lockManagement(manager: EntityManager): Promise<void> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      'aura:admin-user-management',
    ]);
  }

  countActiveAdmins(manager: EntityManager): Promise<number> {
    return this.scoped(manager)
      .createQueryBuilder('user')
      .innerJoin('user.userRoles', 'userRole')
      .innerJoin('userRole.role', 'role')
      .where('user.isDeleted = false')
      .andWhere('user.status = :status', { status: UserStatus.ACTIVE })
      .andWhere('role.code = :code', { code: RoleKey.ADMIN })
      .getCount();
  }

  /** Danh sách user có lọc theo từ khóa + trạng thái, phân trang, kèm role. */
  async listPaginated(options: ListUsersOptions): Promise<Paginated<User>> {
    const page = Math.max(1, options.page);
    const pageSize = Math.max(1, options.pageSize);

    const query = this.repo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userRoles', 'userRole')
      .leftJoinAndSelect('userRole.role', 'role')
      .where('user.isDeleted = :deleted', { deleted: options.deleted ?? false });

    if (options.status) {
      query.andWhere('user.status = :status', { status: options.status });
    }

    if (options.q) {
      query.andWhere(
        new Brackets((builder) => {
          builder
            .where('user.email ILIKE :q', { q: `%${options.q}%` })
            .orWhere('user.displayName ILIKE :q', { q: `%${options.q}%` });
        }),
      );
    }

    const [items, total] = await query
      // Thùng rác: mới xóa trước.
      .orderBy(options.deleted ? 'user.deletedAt' : 'user.createdAt', 'DESC')
      .addOrderBy('user.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total, page, pageSize };
  }
}
