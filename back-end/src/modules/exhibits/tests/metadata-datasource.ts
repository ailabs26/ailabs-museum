import 'reflect-metadata';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { dataSource } from '../../../config/data-source';
import { Exhibit } from '../entities/exhibit.entity';
import { ExhibitRevision } from '../entities/exhibit-revision.entity';
import { Hotspot } from '../entities/hotspot.entity';
import { ExhibitsRepository } from '../repositories/exhibits.repository';

/**
 * Dựng ExhibitsRepository gắn với metadata TypeORM THẬT của dự án nhưng KHÔNG mở kết nối DB.
 * Nhờ vậy test có thể khẳng định SQL sinh ra (getQuery / subquery phân trang) đúng với cấu hình
 * entity/driver postgres thật — bắt được lỗi cấp SQL mà fake QueryBuilder không thấy — mà vẫn chạy
 * được trong CI không có Postgres.
 */
let built = false;

export async function metadataExhibitsRepository(): Promise<ExhibitsRepository> {
  if (!built) {
    // buildMetadatas dựng toàn bộ metadata quan hệ mà không cần connect (khác initialize()).
    await (dataSource as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();
    built = true;
  }
  return new ExhibitsRepository(
    dataSource.getRepository(Exhibit) as never,
    dataSource.getRepository(ExhibitRevision) as never,
    dataSource.getRepository(Hotspot) as never,
  );
}

/**
 * Tái dựng ĐÚNG truy vấn con `distinctAlias` mà TypeORM chạy cho `getManyAndCount` khi có join + take
 * (SelectQueryBuilder: hai truy vấn — truy vấn 1 lấy id theo trang). Trả về { inner, outer }.
 */
export function distinctPaginationSql(qb: SelectQueryBuilder<Exhibit>): { inner: string; outer: string } {
  const anyQb = qb as unknown as {
    createOrderByCombinedWithSelectExpression(alias: string): [string, Record<string, string>];
    clone(): SelectQueryBuilder<Exhibit>;
  };
  const [selects] = anyQb.createOrderByCombinedWithSelectExpression('distinctAlias');
  const inner = anyQb.clone().orderBy().getQuery();
  const outer =
    `SELECT DISTINCT "distinctAlias"."exhibit_id"` +
    (selects ? `, ${selects}` : '') +
    ` FROM (${inner}) "distinctAlias"`;
  return { inner, outer };
}

export { DataSource };
