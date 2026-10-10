import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

/**
 * Bọc giao dịch DB (UnitOfWork). Truyền EntityManager cho các repository trong
 * cùng 1 transaction — dùng cho các luồng nguyên tử như publish revision + audit.
 *
 * @example
 * await this.tx.run(async (manager) => {
 *   await this.revisionRepo.save(rev, manager);
 *   await this.exhibitRepo.update(id, { currentRevisionId: rev.id }, manager);
 *   await this.auditRepo.save(entry, manager);
 * });
 */
@Injectable()
export class TransactionManager {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  run<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(work);
  }
}
