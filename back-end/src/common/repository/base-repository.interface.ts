import {
  DeepPartial,
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsOrder,
  FindOptionsWhere,
  ObjectLiteral,
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Paginated } from '../types/paginated.type';

export interface PaginateOptions<T extends ObjectLiteral> {
  page: number;
  pageSize: number;
  where?: FindOptionsWhere<T> | FindOptionsWhere<T>[];
  order?: FindOptionsOrder<T>;
  relations?: string[];
}

/**
 * Hợp đồng repository dùng chung (port) — service chỉ phụ thuộc interface này.
 * Mượn tinh thần IAsyncRepository<T> của bản .NET, rút gọn cho TypeORM.
 */
export interface IBaseRepository<T extends ObjectLiteral> {
  findById(id: string, relations?: string[]): Promise<T | null>;
  findOne(where: FindOptionsWhere<T>, options?: FindOneOptions<T>): Promise<T | null>;
  findMany(options?: FindManyOptions<T>): Promise<T[]>;
  paginate(options: PaginateOptions<T>): Promise<Paginated<T>>;
  exists(where: FindOptionsWhere<T>): Promise<boolean>;
  count(where?: FindOptionsWhere<T>): Promise<number>;
  create(data: DeepPartial<T>): T;
  save(entity: T | T[], manager?: EntityManager): Promise<T | T[]>;
  update(id: string, data: QueryDeepPartialEntity<T>, manager?: EntityManager): Promise<void>;
  softDelete(id: string, manager?: EntityManager): Promise<void>;
  remove(entity: T, manager?: EntityManager): Promise<T>;
}
