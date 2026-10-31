import { Injectable, NotImplementedException, OnApplicationBootstrap } from '@nestjs/common';
import { UploadJobResponse } from '../dto/upload-job-response.dto';
import { UploadMediaDto } from '../dto/upload-media.dto';
import { MediaUploadJobRepository } from '../repositories/media-upload-job.repository';
import { MediaService, UploadedMediaFile } from './media.service';

export interface EnqueueResult {
  job: UploadJobResponse;
  /** `false` khi đây là retry cùng `Idempotency-Key` — controller trả 200 thay vì 202. */
  created: boolean;
}

@Injectable()
export class MediaUploadJobService implements OnApplicationBootstrap {
  constructor(
    private readonly jobs: MediaUploadJobRepository,
    private readonly media: MediaService,
  ) {}

  // Stub no-op: nếu ném lỗi ở đây thì app không khởi động và mọi test HTTP fail ở hook `before`
  // (sai lý do) thay vì fail ở assertion của từng endpoint.
  async onApplicationBootstrap(): Promise<void> {}

  async enqueue(
    _file: UploadedMediaFile | undefined,
    _dto: UploadMediaDto,
    _actorId: string,
    _idempotencyKey: string | undefined,
  ): Promise<EnqueueResult> {
    throw new NotImplementedException('BT3: enqueue chưa hiện thực');
  }

  async getForActor(_id: string, _actorId: string): Promise<UploadJobResponse> {
    throw new NotImplementedException('BT3: getForActor chưa hiện thực');
  }

  /** Chờ mọi job đang chạy trong tiến trình này xong (dùng khi test/shutdown). */
  async whenIdle(): Promise<void> {
    throw new NotImplementedException('BT3: whenIdle chưa hiện thực');
  }
}
