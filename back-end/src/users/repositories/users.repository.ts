import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Paginated } from '../../common/types/paginated.type';
import { BaseRepository } from '../../core/repository/base.repository';
import { User, UserStatus } from '../user.entity';

export interface ListUsersOptions {
  page: number;
  pageSize: number;
  q?: string;
  status?: UserStatus;
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

  findByIdWithAccess(id: string): Promise<User | null> {
    return this.repo.findOne({
      where: { id, isDeleted: false },
      relations: ACCESS_RELATIONS,
    });
  }

  findActiveById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id, isDeleted: false } });
  }

  /** Nạp user kèm role (cho response), không nạp permission. */
  findDetail(id: string): Promise<User | null> {
    return this.repo.findOne({
      where: { id, isDeleted: false },
      relations: ['userRoles', 'userRoles.role'],
    });
  }

  existsByEmail(email: string): Promise<boolean> {
    return this.exists({ email, isDeleted: false });
  }

  /** Danh sách user có lọc theo từ khóa + trạng thái, phân trang, kèm role. */
  async listPaginated(options: ListUsersOptions): Promise<Paginated<User>> {
    const page = Math.max(1, options.page);
    const pageSize = Math.max(1, options.pageSize);

    const query = this.repo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userRoles', 'userRole')
      .leftJoinAndSelect('userRole.role', 'role')
      .where('user.isDeleted = false');

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
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total, page, pageSize };
  }
}
