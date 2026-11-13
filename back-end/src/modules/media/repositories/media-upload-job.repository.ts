import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, LessThan, Not, QueryFailedError, Repository } from 'typeorm';
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

  /** Job chưa có media khi tiến trình khởi động lại → `failed` (buffer file chỉ nằm trong RAM). */
  async failInterrupted(): Promise<number> {
    const result = await this.repo.update(
      { status: In([UploadJobStatus.QUEUED, UploadJobStatus.PROCESSING]), mediaId: IsNull() },
      {
        status: UploadJobStatus.FAILED,
        progress: 100,
        errorCode: 'job_interrupted',
        errorMessage: 'Máy chủ khởi động lại khi đang xử lý; hãy upload lại với Idempotency-Key mới',
      },
    );
    return result.affected ?? 0;
  }

  /**
   * Gắn media vào job trong transaction tạo media. Job không còn `processing` (instance khác đã ghi
   * `failed`) thì ném lỗi để rollback: thà không có media còn hơn có media mồ côi.
   */
  async linkMedia(id: string, mediaId: string, manager: EntityManager): Promise<void> {
    const result = await this.scoped(manager).update({ id, status: UploadJobStatus.PROCESSING }, { mediaId });
    if (!result.affected) throw new Error(`Job upload ${id} không còn ở processing`);
  }

  /** Ghi `failed` chỉ khi job chưa có media. Trả `false` nếu job đã liên kết media, khi đó job không được failed. */
  async failUnlinked(id: string, data: UploadJobPatch): Promise<boolean> {
    const result = await this.repo.update({ id, mediaId: IsNull() }, data);
    return (result.affected ?? 0) > 0;
  }

  /** Đối soát khi khởi động: job kẹt `processing` đã có media là job đã xong, chỉ chưa ghi được trạng thái. */
  async completeLinked(): Promise<number> {
    const result = await this.repo.update(
      { status: UploadJobStatus.PROCESSING, mediaId: Not(IsNull()) },
      { status: UploadJobStatus.SUCCEEDED, progress: 100 },
    );
    return result.affected ?? 0;
  }

  /** Xóa job đã kết thúc từ trước `cutoff`; job `queued`/`processing` không bao giờ bị xóa ở đây. */
  async deleteFinishedBefore(cutoff: Date): Promise<number> {
    const result = await this.repo.delete({
      status: In([UploadJobStatus.SUCCEEDED, UploadJobStatus.FAILED]),
      updatedAt: LessThan(cutoff),
    });
    return result.affected ?? 0;
  }

  private isActorKeyConflict(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driver = error.driverError as { code?: string; constraint?: string };
    return driver.code === '23505' && driver.constraint === UPLOAD_JOB_ACTOR_KEY_CONSTRAINT;
  }
}
