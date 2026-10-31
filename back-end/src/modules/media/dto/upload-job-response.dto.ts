import { NotImplementedException } from '@nestjs/common';
import { MediaUploadJob, UploadJobStatus } from '../entities/media-upload-job.entity';

export interface UploadJobResponse {
  id: string;
  status: UploadJobStatus;
  /** 0–100; mốc thô theo bước của pipeline (queued 0, processing 50, kết thúc 100). */
  progress: number;
  mediaId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Ánh xạ entity → response; không lộ `requestChecksum`, `idempotencyKey`, `createdById`. */
export function toUploadJobResponse(_job: MediaUploadJob): UploadJobResponse {
  throw new NotImplementedException('BT3: toUploadJobResponse chưa hiện thực');
}
