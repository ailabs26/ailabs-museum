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
export function toUploadJobResponse(job: MediaUploadJob): UploadJobResponse {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    mediaId: job.mediaId ?? null,
    errorCode: job.errorCode ?? null,
    errorMessage: job.errorMessage ?? null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}
