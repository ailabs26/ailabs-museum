import { Injectable, NotImplementedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repository/base.repository';
import { MediaUploadJob } from '../entities/media-upload-job.entity';

export type NewUploadJob = Pick<MediaUploadJob, 'createdById' | 'idempotencyKey' | 'requestChecksum'>;
export type UploadJobPatch = Partial<Pick<MediaUploadJob, 'status' | 'progress' | 'mediaId' | 'errorCode' | 'errorMessage'>>;

@Injectable()
export class MediaUploadJobRepository extends BaseRepository<MediaUploadJob> {
  constructor(@InjectRepository(MediaUploadJob) repo: Repository<MediaUploadJob>) {
    super(repo);
  }

  /** Tạo job mới, hoặc trả job đã có cùng (người tạo, key) — `created` cho biết là job mới. */
  async insertOrFindExisting(_data: NewUploadJob): Promise<{ job: MediaUploadJob; created: boolean }> {
    throw new NotImplementedException('BT3: insertOrFindExisting chưa hiện thực');
  }

  async findOwned(_id: string, _actorId: string): Promise<MediaUploadJob | null> {
    throw new NotImplementedException('BT3: findOwned chưa hiện thực');
  }

  async patch(_id: string, _data: UploadJobPatch): Promise<void> {
    throw new NotImplementedException('BT3: patch chưa hiện thực');
  }

  /** Job còn dang dở khi tiến trình khởi động lại → `failed` (buffer file chỉ nằm trong RAM). */
  async failInterrupted(): Promise<number> {
    throw new NotImplementedException('BT3: failInterrupted chưa hiện thực');
  }
}
