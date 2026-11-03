import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ApiError } from '../../../common/dto/api-response';
import { toUploadJobResponse, UploadJobResponse } from '../dto/upload-job-response.dto';
import { UploadMediaDto } from '../dto/upload-media.dto';
import { UploadJobStatus } from '../entities/media-upload-job.entity';
import { MediaErrorCode } from '../inspection/media-format.error';
import { MediaUploadJobRepository } from '../repositories/media-upload-job.repository';
import { MediaService, UploadedMediaFile } from './media.service';

export interface EnqueueResult {
  job: UploadJobResponse;
  /** `false` khi đây là retry cùng `Idempotency-Key` — controller trả 200 thay vì 202. */
  created: boolean;
}

const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
/** Metadata đi kèm file; cùng key mà khác các trường này cũng là request khác. */
const FINGERPRINT_FIELDS = ['kind', 'altText', 'source', 'author', 'license'] as const;
const INTERNAL_ERROR_MESSAGE = 'Lỗi không xác định khi xử lý file; hãy upload lại với Idempotency-Key mới';
/** Số lần thử ghi job succeeded sau khi media đã lưu (lỗi DB tạm thời). */
const COMPLETION_ATTEMPTS = 3;

function headerError(code: string, message: string): ApiError[] {
  return [{ field: IDEMPOTENCY_KEY_HEADER, code, message }];
}

/** SHA-256 của nội dung file + metadata theo thứ tự cố định. */
function fingerprint(buffer: Buffer, dto: UploadMediaDto): string {
  const metadata = FINGERPRINT_FIELDS.map((field) => dto[field] ?? null);
  return createHash('sha256').update(buffer).update(JSON.stringify(metadata)).digest('hex');
}

/** Lấy mã lỗi từ exception của pipeline; lỗi không lường trước không lộ chi tiết hạ tầng. */
function describeFailure(error: unknown): { code: string; message: string } {
  if (error instanceof HttpException) {
    const body = error.getResponse() as { message?: unknown; errors?: ApiError[] };
    const first = Array.isArray(body?.errors) ? body.errors[0] : undefined;
    if (first?.code) {
      return { code: first.code, message: typeof body.message === 'string' ? body.message : first.message };
    }
  }
  return { code: 'internal_error', message: INTERNAL_ERROR_MESSAGE };
}

/**
 * Upload media bất đồng bộ (VT-078). Request chỉ kiểm tra rẻ (key, có file) và tạo job;
 * pipeline có sẵn `MediaService.upload()` chạy sau khi response đã trả. Chỉ request tạo
 * mới job mới khởi chạy worker, nên retry cùng key không bao giờ chạy lại pipeline.
 */
@Injectable()
export class MediaUploadJobService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MediaUploadJobService.name);
  private readonly running = new Set<Promise<void>>();
  /** Thời gian chờ giữa các lần thử ghi job succeeded; public để test đặt 0. */
  completionRetryDelayMs = 200;

  constructor(
    private readonly jobs: MediaUploadJobRepository,
    private readonly media: MediaService,
  ) {}

  /**
   * Buffer file chỉ nằm trong RAM của tiến trình, nên job dang dở từ lần chạy trước không thể
   * tiếp tục: đánh dấu failed để client không chờ mãi. Giả định một instance API xử lý job.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const interrupted = await this.jobs.failInterrupted();
      if (interrupted > 0) this.logger.warn(`Đánh dấu ${interrupted} job upload bị gián đoạn khi khởi động lại`);
    } catch (error) {
      this.logger.error(`Không dọn được job upload dang dở: ${(error as Error)?.message ?? String(error)}`);
    }
  }

  async enqueue(
    file: UploadedMediaFile | undefined,
    dto: UploadMediaDto,
    actorId: string,
    idempotencyKey: string | undefined,
  ): Promise<EnqueueResult> {
    const key = this.parseKey(idempotencyKey);
    if (!file || !Buffer.isBuffer(file.buffer)) {
      const message = 'Thiếu file upload (field "file" trong multipart/form-data)';
      throw new BadRequestException({ message, errors: [{ field: 'file', code: MediaErrorCode.FILE_REQUIRED, message }] });
    }

    const requestChecksum = fingerprint(file.buffer, dto);
    const { job, created } = await this.jobs.insertOrFindExisting({ createdById: actorId, idempotencyKey: key, requestChecksum });
    if (!created && job.requestChecksum !== requestChecksum) {
      const message = 'Idempotency-Key này đã dùng cho một upload khác; hãy dùng key mới';
      throw new ConflictException({ message, errors: headerError('idempotency_key_reused', message) });
    }
    if (created) this.schedule(job.id, file, dto, actorId);
    return { job: toUploadJobResponse(job), created };
  }

  async getForActor(id: string, actorId: string): Promise<UploadJobResponse> {
    const job = await this.jobs.findOwned(id, actorId);
    if (!job) throw new NotFoundException('Không tìm thấy job upload');
    return toUploadJobResponse(job);
  }

  /** Chờ mọi job đang chạy trong tiến trình này xong (dùng khi test/shutdown). */
  async whenIdle(): Promise<void> {
    while (this.running.size > 0) await Promise.allSettled([...this.running]);
  }

  private parseKey(value: string | undefined): string {
    if (value === undefined || value === '') {
      const message = 'Thiếu header Idempotency-Key';
      throw new BadRequestException({ message, errors: headerError('idempotency_key_required', message) });
    }
    if (!IDEMPOTENCY_KEY_PATTERN.test(value)) {
      const message = 'Idempotency-Key phải gồm 1–128 ký tự chữ, số, "_" hoặc "-"';
      throw new BadRequestException({ message, errors: headerError('idempotency_key_invalid', message) });
    }
    return value;
  }

  /** Chạy pipeline sau khi response đã gửi (setImmediate), không chặn request tạo job. */
  private schedule(jobId: string, file: UploadedMediaFile, dto: UploadMediaDto, actorId: string): void {
    const task = new Promise<void>((resolve) => setImmediate(resolve)).then(() => this.process(jobId, file, dto, actorId));
    this.running.add(task);
    void task.finally(() => this.running.delete(task));
  }

  private async process(jobId: string, file: UploadedMediaFile, dto: UploadMediaDto, actorId: string): Promise<void> {
    let mediaId: string;
    try {
      await this.jobs.patch(jobId, { status: UploadJobStatus.PROCESSING, progress: 50 });
      mediaId = (await this.media.upload(file, dto, actorId)).id;
    } catch (error) {
      await this.markFailed(jobId, error);
      return;
    }
    // Media đã lưu: từ đây lỗi chỉ là lỗi ghi trạng thái job, KHÔNG được ghi failed (job sẽ thiếu mediaId
    // trong khi media "ready" tồn tại, và retry cùng key không chạy lại worker).
    await this.markSucceeded(jobId, mediaId);
  }

  private async markFailed(jobId: string, error: unknown): Promise<void> {
    const failure = describeFailure(error);
    if (failure.code === 'internal_error') {
      this.logger.error(`Job upload ${jobId} lỗi: ${(error as Error)?.message ?? String(error)}`);
    }
    await this.jobs
      .patch(jobId, { status: UploadJobStatus.FAILED, progress: 100, errorCode: failure.code, errorMessage: failure.message })
      .catch((patchError: Error) => this.logger.error(`Không cập nhật được job ${jobId}: ${patchError.message}`));
  }

  /**
   * Thử ghi succeeded tối đa COMPLETION_ATTEMPTS lần. Nếu vẫn lỗi: giữ job ở processing (không xóa
   * media, không ghi failed) và log mediaId để đối soát thủ công.
   */
  private async markSucceeded(jobId: string, mediaId: string): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await this.jobs.patch(jobId, { status: UploadJobStatus.SUCCEEDED, progress: 100, mediaId });
        return;
      } catch (error) {
        const reason = (error as Error)?.message ?? String(error);
        if (attempt >= COMPLETION_ATTEMPTS) {
          this.logger.error(
            `Job upload ${jobId}: media ${mediaId} đã lưu nhưng không ghi được trạng thái succeeded sau ${attempt} lần (${reason}); job giữ processing, cần đối soát`,
          );
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, this.completionRetryDelayMs));
      }
    }
  }
}
