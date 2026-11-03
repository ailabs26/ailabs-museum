import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { AuditService } from '../../audit/services/audit.service';
import { MediaRepository } from '../repositories/media.repository';
import { MediaStorageService } from './media-storage.service';

export type MediaCleanupMode = 'off' | 'dry-run' | 'on';

/** File mới hơn mốc này có thể đang trong quá trình upload (ghi file trước, ghi DB sau) — không đụng. */
export const ORPHAN_FILE_GRACE_MS = 24 * 60 * 60 * 1000;
const PURGE_BATCH = 200;
const KEY_BATCH = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface MediaCleanupReport {
  mode: MediaCleanupMode;
  /** Media đã xóa mềm quá hạn, không còn được tham chiếu: đã xóa hẳn (on) hoặc sẽ xóa (dry-run). */
  purgedMedia: number;
  /** File trong storage không có bản ghi media: đã xóa (on) hoặc sẽ xóa (dry-run). */
  orphanFiles: number;
  /** Lỗi từng mục (không dừng cả job). */
  errors: number;
}

/**
 * Dọn media mồ côi hằng đêm:
 * 1. Media xóa mềm quá `trashRetentionDays` và không revision nào tham chiếu → xóa bản ghi (ghi audit `media.purge`) rồi
 *    xóa file. Xóa file lỗi thì file đó thành loại 2 và được dọn ở lần sau.
 * 2. File do media quản lý (đúng mẫu key) nhưng không có bản ghi và cũ hơn 24 giờ → xóa (upload dở dang).
 */
@Injectable()
export class MediaCleanupService {
  private readonly logger = new Logger(MediaCleanupService.name);

  constructor(
    private readonly media: MediaRepository,
    private readonly storage: MediaStorageService,
    private readonly tx: TransactionManager,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  @Cron('30 3 * * *', { name: 'media-orphan-cleanup' })
  async handleCron(): Promise<void> {
    const mode = this.config.get<MediaCleanupMode>('media.orphanCleanup') ?? 'dry-run';
    if (mode === 'off') return;
    try {
      const report = await this.run(mode);
      this.logger.log(JSON.stringify({ message: 'Dọn media mồ côi xong', ...report }));
    } catch (error) {
      this.logger.error('Dọn media mồ côi thất bại', error instanceof Error ? error.stack : String(error));
    }
  }

  async run(mode: Exclude<MediaCleanupMode, 'off'>, now = new Date()): Promise<MediaCleanupReport> {
    const report: MediaCleanupReport = { mode, purgedMedia: 0, orphanFiles: 0, errors: 0 };
    const retentionDays = this.config.get<number>('media.trashRetentionDays') ?? 30;
    await this.purgeExpiredTrash(new Date(now.getTime() - retentionDays * DAY_MS), retentionDays, mode, report);
    await this.removeOrphanFiles(new Date(now.getTime() - ORPHAN_FILE_GRACE_MS), mode, report);
    return report;
  }

  private async purgeExpiredTrash(
    cutoff: Date, retentionDays: number, mode: 'dry-run' | 'on', report: MediaCleanupReport,
  ): Promise<void> {
    if (mode === 'dry-run') {
      report.purgedMedia = await this.media.countPurgeable(cutoff);
      return;
    }
    const requestId = `media-cleanup-${randomUUID()}`;
    for (;;) {
      const removed = await this.tx.run((manager) => this.media.deletePurgeable(cutoff, PURGE_BATCH, manager));
      for (const row of removed) {
        report.purgedMedia++;
        await this.audit.recordSafely({
          actorId: null, action: 'media.purge', resourceType: 'media', resourceId: row.id, requestId,
          reason: JSON.stringify({ storageKey: row.storageKey, retentionDays }),
        });
        await this.storage.remove(row.storageKey).catch((error: Error) => {
          report.errors++;
          this.logger.warn(`Đã xóa bản ghi media ${row.id} nhưng chưa xóa được file ${row.storageKey}: ${error.message}`);
        });
      }
      if (removed.length < PURGE_BATCH) return;
    }
  }

  private async removeOrphanFiles(olderThan: Date, mode: 'dry-run' | 'on', report: MediaCleanupReport): Promise<void> {
    let batch: string[] = [];
    const flush = async () => {
      const existing = await this.media.findExistingStorageKeys(batch);
      for (const key of batch.filter((candidate) => !existing.has(candidate))) {
        report.orphanFiles++;
        if (mode === 'on') {
          await this.storage.remove(key).catch((error: Error) => {
            report.errors++;
            this.logger.warn(`Không xóa được file mồ côi ${key}: ${error.message}`);
          });
        }
      }
      batch = [];
    };
    for await (const object of this.storage.listManaged()) {
      if (object.lastModified >= olderThan) continue;
      batch.push(object.key);
      if (batch.length >= KEY_BATCH) await flush();
    }
    if (batch.length > 0) await flush();
  }
}
