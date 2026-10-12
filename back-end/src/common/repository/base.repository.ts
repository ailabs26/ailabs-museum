import {
  DeepPartial,
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Paginated } from '../types/paginated.type';
import { IBaseRepository, PaginateOptions } from './base-repository.interface';

/**
 * Adapter bọc Repository<T> của TypeORM, triển khai IBaseRepository<T>.
 * Repository từng module `extends` lớp này và thêm truy vấn đặc thù.
 * Tham số `manager` (tùy chọn) cho phép chạy trong cùng 1 transaction (xem TransactionManager).
 */
export abstract class BaseRepository<T extends ObjectLiteral> implements IBaseRepository<T> {
  protected constructor(protected readonly repo: Repository<T>) {}

  /** Lấy repository gắn với EntityManager của transaction (nếu có). */
  protected scoped(manager?: EntityManager): Repository<T> {
    return manager ? manager.getRepository<T>(this.repo.target) : this.repo;
  }

  findById(id: string, relations: string[] = []): Promise<T | null> {
    return this.repo.findOne({
      where: { id } as unknown as FindOptionsWhere<T>,
      relations,
    });
  }

  findOne(where: FindOptionsWhere<T>, options: FindOneOptions<T> = {}): Promise<T | null> {
    return this.repo.findOne({ where, ...options });
  }

  findMany(options: FindManyOptions<T> = {}): Promise<T[]> {
    return this.repo.find(options);
  }

  async paginate(options: PaginateOptions<T>): Promise<Paginated<T>> {
    const page = Math.max(1, options.page);
    const pageSize = Math.max(1, options.pageSize);
    const [items, total] = await this.repo.findAndCount({
      where: options.where,
      order: options.order,
      relations: options.relations,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  async exists(where: FindOptionsWhere<T>): Promise<boolean> {
    const count = await this.repo.count({ where });
    return count > 0;
  }

  count(where?: FindOptionsWhere<T>): Promise<number> {
    return this.repo.count(where ? { where } : {});
  }

  create(data: DeepPartial<T>): T {
    return this.repo.create(data);
  }

  save(entity: T | T[], manager?: EntityManager): Promise<T | T[]> {
    const repo = this.scoped(manager);
    return Array.isArray(entity) ? repo.save(entity) : repo.save(entity);
  }

  async update(id: string, data: QueryDeepPartialEntity<T>, manager?: EntityManager): Promise<void> {
    await this.scoped(manager).update(id, data);
  }

  async softDelete(id: string, manager?: EntityManager): Promise<void> {
    await this.scoped(manager).softDelete(id);
  }

  remove(entity: T, manager?: EntityManager): Promise<T> {
    return this.scoped(manager).remove(entity);
  }
}
