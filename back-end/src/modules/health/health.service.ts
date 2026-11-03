import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/** Kiểm tra phụ thuộc bên ngoài cho readiness probe. */
@Injectable()
export class HealthService {
  /** Quá thời gian này coi như DB không sẵn sàng (ghi đè được trong test). */
  timeoutMs = 2000;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** `SELECT 1` tới DB; trả độ trễ (ms), ném lỗi khi DB lỗi hoặc quá `timeoutMs`. */
  async pingDatabase(): Promise<number> {
    const startedAt = Date.now();
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Database ping quá ${this.timeoutMs}ms`)), this.timeoutMs);
    });
    try {
      await Promise.race([this.dataSource.query('SELECT 1'), timeout]);
      return Date.now() - startedAt;
    } finally {
      clearTimeout(timer);
    }
  }
}
