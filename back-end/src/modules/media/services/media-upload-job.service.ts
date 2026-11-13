import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiError } from '../../../common/dto/api-response';
import type { AuditClientInfo } from '../../audit/audit-request.util';
import { AuditService } from '../../audit/services/audit.service';
import { toUploadJobResponse, UploadJobResponse } from '../dto/upload-job-response.dto';
import { UploadMediaDto } from '../dto/upload-media.dto';
import { UploadJobStatus } from '../entities/media-upload-job.entity';
import { MediaErrorCode } from '../inspection/media-format.error';
import { MediaUploadJobRepository } from '../repositories/media-upload-job.repository';
import { MediaSavedHook, MediaService, UploadedMediaFile } from './media.service';

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
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_RETENTION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Dữ liệu một job chờ chạy. Buffer file nằm ở đây cho tới khi job xong. */
interface UploadTask {
  jobId: string;
  file: UploadedMediaFile;
  dto: UploadMediaDto;
  actorId: string;
  client: AuditClientInfo;
}

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
 * mới job mới vào hàng đợi, nên retry cùng key không bao giờ chạy lại pipeline.
 *
 * Hàng đợi FIFO trong tiến trình giới hạn số pipeline chạy cùng lúc. Nó không giới hạn RAM:
 * job đang chờ vẫn giữ buffer file (multer đã đọc xong trước khi vào service).
 */
@Injectable()
export class MediaUploadJobService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MediaUploadJobService.name);
  private readonly running = new Set<Promise<void>>();
  private readonly queue: UploadTask[] = [];
  private readonly concurrency: number;
  private readonly retentionDays: number;
  /** Thời gian chờ giữa các lần thử ghi job succeeded; public để test đặt 0. */
  completionRetryDelayMs = 200;

  constructor(
    private readonly jobs: MediaUploadJobRepository,
    private readonly media: MediaService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.concurrency = config.get<number>('media.uploadJobConcurrency') ?? DEFAULT_CONCURRENCY;
    this.retentionDays = config.get<number>('media.uploadJobRetentionDays') ?? DEFAULT_RETENTION_DAYS;
  }

  /**
   * Job đã có media chỉ còn thiếu trạng thái nên được hoàn tất. Job chưa có media thì không thể tiếp
   * tục vì buffer file chỉ nằm trong RAM: đánh dấu failed để client không chờ mãi. Hai bước độc lập:
   * `failInterrupted` tự bỏ qua job có media nên đối soát lỗi cũng không làm job đó failed.
   * Giả định một instance API xử lý job.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const completed = await this.jobs.completeLinked();
      if (completed > 0) this.logger.warn(`Đối soát ${completed} job upload đã có media sang succeeded`);
    } catch (error) {
      this.logger.error(`Không đối soát được job upload đã có media: ${(error as Error)?.message ?? String(error)}`);
    }
    try {
      const interrupted = await this.jobs.failInterrupted();
      if (interrupted > 0) this.logger.warn(`Đánh dấu ${interrupted} job upload bị gián đoạn khi khởi động lại`);
    } catch (error) {
      this.logger.error(`Không dọn được job upload dang dở: ${(error as Error)?.message ?? String(error)}`);
    }
    await this.purgeFinishedJobs();
  }

  /** Chạy sau `failInterrupted`, và job vừa bị gián đoạn có `updatedAt` mới nên không bị xóa ngay. */
  private async purgeFinishedJobs(): Promise<void> {
    try {
      const removed = await this.jobs.deleteFinishedBefore(new Date(Date.now() - this.retentionDays * DAY_MS));
      if (removed > 0) this.logger.log(`Đã dọn ${removed} job upload cũ hơn ${this.retentionDays} ngày`);
    } catch (error) {
      this.logger.error(`Không dọn được job upload cũ: ${(error as Error)?.message ?? String(error)}`);
    }
  }

  async enqueue(
    file: UploadedMediaFile | undefined,
    dto: UploadMediaDto,
    actorId: string,
    idempotencyKey: string | undefined,
    client: AuditClientInfo = { ip: null, userAgent: null, requestId: randomUUID() },
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
    if (created) {
      this.queue.push({ jobId: job.id, file, dto, actorId, client });
      this.drain();
    }
    return { job: toUploadJobResponse(job), created };
  }

  async getForActor(id: string, actorId: string): Promise<UploadJobResponse> {
    const job = await this.jobs.findOwned(id, actorId);
    if (!job) throw new NotFoundException('Không tìm thấy job upload');
    return toUploadJobResponse(job);
  }

  /**
   * Chờ mọi job trong tiến trình này xong, kể cả job còn trong hàng đợi (dùng khi test/shutdown):
   * job kế tiếp được đưa vào `running` trước khi job vừa xong resolve, nên vòng lặp không thoát sớm.
   */
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

  /**
   * Lấy job từ đầu hàng đợi tới khi đủ slot. Pipeline chạy sau khi response đã gửi (setImmediate),
   * không chặn request tạo job. Slot luôn được trả ở `finally`, kể cả khi worker ném lỗi.
   */
  private drain(): void {
    while (this.running.size < this.concurrency) {
      const task = this.queue.shift();
      if (!task) return;
      const run: Promise<void> = new Promise<void>((resolve) => setImmediate(resolve))
        .then(() => this.process(task))
        .catch((error: Error) => this.logger.error(`Worker job upload ${task.jobId} lỗi: ${error?.message ?? String(error)}`))
        .finally(() => {
          this.running.delete(run);
          this.drain();
        });
      this.running.add(run);
    }
  }

  private async process({ jobId, file, dto, actorId, client }: UploadTask): Promise<void> {
    let mediaId: string | null;
    try {
      await this.jobs.patch(jobId, { status: UploadJobStatus.PROCESSING, progress: 50 });
      const link: MediaSavedHook = (id, manager) => this.jobs.linkMedia(jobId, id, manager);
      mediaId = (await this.media.upload(file, dto, actorId, link)).id;
    } catch (error) {
      // upload() có thể ném lỗi sau khi transaction đã commit: job đã liên kết thì vẫn là thành công.
      mediaId = await this.markFailed(jobId, error);
      if (!mediaId) return;
    }
    // Media đã lưu và job đã giữ mediaId: từ đây lỗi chỉ là lỗi ghi trạng thái, không được ghi failed.
    await this.markSucceeded(jobId, mediaId);
    // Worker chạy ngoài AuditInterceptor nên tự ghi. Ghi cả khi job kẹt processing: media đã tồn tại thật.
    await this.audit.recordSafely({ actorId, action: 'media.upload', resourceType: 'media', resourceId: mediaId, ...client });
  }

  /** Ghi failed nếu job chưa có media; job đã có media thì trả mediaId để worker hoàn tất. */
  private async markFailed(jobId: string, error: unknown): Promise<string | null> {
    const failure = describeFailure(error);
    if (failure.code === 'internal_error') {
      this.logger.error(`Job upload ${jobId} lỗi: ${(error as Error)?.message ?? String(error)}`);
    }
    try {
      const patch = { status: UploadJobStatus.FAILED, progress: 100, errorCode: failure.code, errorMessage: failure.message };
      if (await this.jobs.failUnlinked(jobId, patch)) return null;
      return (await this.jobs.findById(jobId))?.mediaId ?? null;
    } catch (patchError) {
      this.logger.error(`Không cập nhật được job ${jobId}: ${(patchError as Error).message}`);
      return null;
    }
  }

  /**
   * Thử ghi succeeded tối đa COMPLETION_ATTEMPTS lần. Nếu vẫn lỗi: giữ job ở processing (không xóa
   * media, không ghi failed); job đã có mediaId nên lần khởi động sau sẽ hoàn tất.
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
            `Job upload ${jobId}: media ${mediaId} đã lưu nhưng không ghi được trạng thái succeeded sau ${attempt} lần (${reason}); job giữ processing tới lần khởi động sau`,
          );
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, this.completionRetryDelayMs));
      }
    }
  }
}
