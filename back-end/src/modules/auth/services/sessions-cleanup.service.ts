import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { RefreshSessionsRepository } from '../repositories/refresh-sessions.repository';

/** Giữ family đã chết thêm 7 ngày (tra cứu/điều tra) trước khi xóa hẳn. */
export const DEAD_SESSION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
/** Số family xóa mỗi transaction, tránh khóa bảng lâu. */
export const CLEANUP_BATCH_FAMILIES = 500;

/** Dọn định kỳ `refresh_sessions` đã hết hạn/bị thu hồi để bảng không phình vô hạn. */
@Injectable()
export class SessionsCleanupService {
  private readonly logger = new Logger(SessionsCleanupService.name);

  constructor(
    private readonly sessions: RefreshSessionsRepository,
    private readonly tx: TransactionManager,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'refresh-sessions-cleanup' })
  async handleCron(): Promise<void> {
    try {
      const deleted = await this.purgeDeadSessions();
      this.logger.log(`Đã xóa ${deleted} refresh session hết hạn/bị thu hồi`);
    } catch (error) {
      this.logger.error('Dọn refresh session thất bại', error instanceof Error ? error.stack : String(error));
    }
  }

  /** Xóa theo lô cho tới khi hết family đủ điều kiện; trả tổng số row đã xóa. */
  async purgeDeadSessions(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - DEAD_SESSION_RETENTION_MS);
    let total = 0;
    for (;;) {
      const deleted = await this.tx.run((manager) =>
        this.sessions.deleteDeadFamilies(cutoff, CLEANUP_BATCH_FAMILIES, manager),
      );
      total += deleted;
      if (deleted === 0) {
        return total;
      }
    }
  }
}
