import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repository/base.repository';
import { MediaUploadJob, UPLOAD_JOB_ACTOR_KEY_CONSTRAINT, UploadJobStatus } from '../entities/media-upload-job.entity';

export type NewUploadJob = Pick<MediaUploadJob, 'createdById' | 'idempotencyKey' | 'requestChecksum'>;
export type UploadJobPatch = Partial<Pick<MediaUploadJob, 'status' | 'progress' | 'mediaId' | 'errorCode' | 'errorMessage'>>;

@Injectable()
export class MediaUploadJobRepository extends BaseRepository<MediaUploadJob> {
  constructor(@InjectRepository(MediaUploadJob) repo: Repository<MediaUploadJob>) {
    super(repo);
  }

  /**
   * Tạo job mới, hoặc trả job đã có cùng (người tạo, key) — `created` cho biết là job mới.
   * Insert trước rồi mới đọc lại khi trùng: không "tìm rồi insert" vì hai request đồng thời
   * đều thấy chưa có. Unique constraint quyết định request nào thắng.
   */
  async insertOrFindExisting(data: NewUploadJob): Promise<{ job: MediaUploadJob; created: boolean }> {
    try {
      const job = await this.repo.save(this.repo.create(data));
      return { job, created: true };
    } catch (error) {
      if (!this.isActorKeyConflict(error)) throw error;
      const existing = await this.repo.findOne({
        where: { createdById: data.createdById, idempotencyKey: data.idempotencyKey },
      });
      if (!existing) throw error;
      return { job: existing, created: false };
    }
  }

  findOwned(id: string, actorId: string): Promise<MediaUploadJob | null> {
    return this.repo.findOne({ where: { id, createdById: actorId } });
  }

  async patch(id: string, data: UploadJobPatch): Promise<void> {
    await this.repo.update(id, data);
  }

  /** Job còn dang dở khi tiến trình khởi động lại → `failed` (buffer file chỉ nằm trong RAM). */
  async failInterrupted(): Promise<number> {
    const result = await this.repo.update(
      { status: In([UploadJobStatus.QUEUED, UploadJobStatus.PROCESSING]) },
      {
        status: UploadJobStatus.FAILED,
        progress: 100,
        errorCode: 'job_interrupted',
        errorMessage: 'Máy chủ khởi động lại khi đang xử lý; hãy upload lại với Idempotency-Key mới',
      },
    );
    return result.affected ?? 0;
  }

  private isActorKeyConflict(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driver = error.driverError as { code?: string; constraint?: string };
    return driver.code === '23505' && driver.constraint === UPLOAD_JOB_ACTOR_KEY_CONSTRAINT;
  }
}
