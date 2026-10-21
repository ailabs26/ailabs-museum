import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { DomainValidationException } from '../../../common/exceptions/validation.exception';
import { Paginated } from '../../../common/types/paginated.type';
import { ListMediaQueryDto } from '../dto/list-media-query.dto';
import { MediaResponse, toMediaResponse } from '../dto/media-response.dto';
import { UpdateMediaDto } from '../dto/update-media.dto';
import { UploadMediaDto } from '../dto/upload-media.dto';
import { Media, MediaProcessingState } from '../entities/media.entity';
import { MediaErrorCode, MediaFormatError } from '../inspection/media-format.error';
import { MEGABYTE, MediaFormatSpec } from '../inspection/media-formats';
import { MediaRepository } from '../repositories/media.repository';
import { MediaInspectionService } from './media-inspection.service';
import { MediaStorageService } from './media-storage.service';
import { MediaUrlService } from './media-url.service';

/** Phần file multer cung cấp mà service cần (memory storage). */
export interface UploadedMediaFile {
  buffer: Buffer;
  originalname?: string;
}

const METADATA_FIELDS = ['altText', 'source', 'author', 'license'] as const;
const MAX_ORIGINAL_NAME_LENGTH = 255;

function fileError(code: MediaErrorCode, message: string) {
  return [{ field: 'file', code, message }];
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / MEGABYTE).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} MB`;
}

/**
 * Làm sạch tên file gốc để lưu hiển thị: sửa tên UTF-8 bị multer đọc thành latin1,
 * bỏ phần đường dẫn và ký tự điều khiển, giới hạn độ dài.
 */
export function sanitizeOriginalName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  // Busboy giải mã tên file theo latin1: mỗi byte UTF-8 thành một ký tự U+0080–U+00FF.
  const isLatin1Mojibake = /[\u0080-ÿ]/.test(name) && !/[Ā-￿]/.test(name);
  const decoded = isLatin1Mojibake ? Buffer.from(name, 'latin1').toString('utf8') : name;
  const readable = decoded.includes('�') ? name : decoded;
  const baseName = readable.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = baseName.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return cleaned ? Array.from(cleaned).slice(0, MAX_ORIGINAL_NAME_LENGTH).join('') : null;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly mediaRepo: MediaRepository,
    private readonly storage: MediaStorageService,
    private readonly inspection: MediaInspectionService,
    private readonly tx: TransactionManager,
    private readonly urls: MediaUrlService,
  ) {}

  /** Thư viện media cho Admin CMS (phân trang, lọc kind/trạng thái). */
  async list(query: ListMediaQueryDto): Promise<Paginated<MediaResponse>> {
    const result = await this.mediaRepo.listPaginated(query);
    return { ...result, items: result.items.map((media) => this.toResponse(media)) };
  }

  async getById(id: string): Promise<MediaResponse> {
    return this.toResponse(await this.findOrFail(id));
  }

  /**
   * Mở nội dung media `ready` cho công cụ CMS cần đọc file (vd chọn tọa độ hotspot trên GLB) —
   * dùng được cả với file seed nằm ngoài `uploads/` (không có URL ký). File cách ly/lỗi: 404.
   */
  async openContent(id: string): Promise<{ media: Media; stream: Readable }> {
    const media = await this.findOrFail(id);
    const stream =
      media.processingState === MediaProcessingState.READY ? await this.storage.openPublic(media.storageKey) : null;
    if (!stream) throw new NotFoundException('Không tìm thấy nội dung media');
    return { media, stream };
  }

  /**
   * Pipeline upload (FR-55–57, NFR-19): nhận diện định dạng thực tế → kiểm tra dung lượng
   * theo định dạng → parse/decode → lưu file → tạo bản ghi. File bị từ chối không được lưu.
   * File gây lỗi không rõ nguyên nhân khi phân tích được đưa vào quarantine.
   */
  async upload(file: UploadedMediaFile | undefined, dto: UploadMediaDto, actorId: string | null): Promise<MediaResponse> {
    if (!file || !Buffer.isBuffer(file.buffer)) {
      const message = 'Thiếu file upload (field "file" trong multipart/form-data)';
      throw new BadRequestException({ message, errors: fileError(MediaErrorCode.FILE_REQUIRED, message) });
    }
    const buffer = file.buffer;
    const spec = this.identifyOrReject(buffer);

    if (dto.kind && dto.kind !== spec.kind) {
      throw this.reject(
        MediaErrorCode.KIND_MISMATCH,
        `Nội dung file là ${spec.label} (kind "${spec.kind}"), không khớp kind "${dto.kind}" đã chọn`,
      );
    }
    if (buffer.length > spec.maxBytes) {
      const message = `${spec.label} vượt giới hạn ${formatMegabytes(spec.maxBytes)} (file: ${formatMegabytes(buffer.length)})`;
      throw new PayloadTooLargeException({ message, errors: fileError(MediaErrorCode.TOO_LARGE, message) });
    }

    try {
      this.inspection.validateStructure(spec, buffer);
    } catch (error) {
      if (error instanceof MediaFormatError) throw this.reject(error.code, error.message);
      const quarantined = await this.persist(buffer, spec, file, dto, actorId, MediaProcessingState.QUARANTINED);
      this.logger.warn(`Media ${quarantined.id} bị cách ly: ${(error as Error)?.message ?? String(error)}`);
      throw this.reject(
        MediaErrorCode.QUARANTINED,
        `File có cấu trúc bất thường và đã được cách ly để quản trị viên kiểm tra (mã media: ${quarantined.id})`,
      );
    }

    const media = await this.persist(buffer, spec, file, dto, actorId, MediaProcessingState.READY);
    return this.toResponse(media);
  }

  /** Cập nhật metadata mô tả & quyền sử dụng. File không bao giờ bị thay thế (BR-21). */
  async update(id: string, dto: UpdateMediaDto): Promise<MediaResponse> {
    const media = await this.findOrFail(id);
    for (const field of METADATA_FIELDS) {
      if (dto[field] !== undefined) media[field] = dto[field] ?? null;
    }
    return this.toResponse((await this.mediaRepo.save(media)) as Media);
  }

  /**
   * Xóa mềm media. BR-21: từ chối nếu exhibit đã xuất bản đang dùng; cũng từ chối khi
   * nội dung chờ duyệt đang dùng. Kiểm tra và xóa chạy trong transaction có khóa dòng.
   */
  async remove(id: string): Promise<void> {
    const storageKey = await this.tx.run(async (manager) => {
      const media = await this.mediaRepo.lockActiveById(id, manager);
      if (!media) throw new NotFoundException('Không tìm thấy media');

      const usage = await this.mediaRepo.countUsage(id, manager);
      if (usage.publishedExhibits > 0) {
        throw new ConflictException(
          `Media đang được ${usage.publishedExhibits} hiện vật đã xuất bản sử dụng nên không thể xóa (BR-21)`,
        );
      }
      if (usage.pendingRevisions > 0) {
        throw new ConflictException(
          `Media đang nằm trong ${usage.pendingRevisions} bản nội dung chờ duyệt nên không thể xóa`,
        );
      }

      media.isDeleted = true;
      media.deletedAt = new Date();
      await this.mediaRepo.save(media, manager);
      return media.storageKey;
    });

    // Database là nguồn sự thật; dọn file sau khi commit, lỗi dọn file chỉ ghi log.
    try {
      await this.storage.remove(storageKey);
    } catch (error) {
      this.logger.warn(`Không xóa được file ${storageKey}: ${(error as Error).message}`);
    }
  }

  private identifyOrReject(buffer: Buffer): MediaFormatSpec {
    try {
      return this.inspection.identify(buffer);
    } catch (error) {
      if (error instanceof MediaFormatError) throw this.reject(error.code, error.message);
      throw error;
    }
  }

  /** Lưu file rồi tạo bản ghi; nếu ghi DB thất bại thì dọn file vừa lưu. */
  private async persist(
    buffer: Buffer,
    spec: MediaFormatSpec,
    file: UploadedMediaFile,
    dto: UploadMediaDto,
    actorId: string | null,
    state: MediaProcessingState,
  ): Promise<Media> {
    const storageKey = this.storage.createKey(spec, state === MediaProcessingState.QUARANTINED);
    await this.storage.save(storageKey, buffer);
    try {
      const media = this.mediaRepo.create({
        kind: spec.kind,
        storageKey,
        mimeType: spec.mimeType,
        sizeBytes: String(buffer.length),
        checksumSha256: createHash('sha256').update(buffer).digest('hex'),
        processingState: state,
        originalName: sanitizeOriginalName(file.originalname),
        altText: dto.altText ?? null,
        source: dto.source ?? null,
        author: dto.author ?? null,
        license: dto.license ?? null,
        createdById: actorId,
      });
      return (await this.mediaRepo.save(media)) as Media;
    } catch (error) {
      await this.storage.remove(storageKey).catch((cleanupError: Error) =>
        this.logger.warn(`Không dọn được file ${storageKey}: ${cleanupError.message}`),
      );
      throw error;
    }
  }

  private async findOrFail(id: string): Promise<Media> {
    const media = await this.mediaRepo.findActiveById(id);
    if (!media) throw new NotFoundException('Không tìm thấy media');
    return media;
  }

  private reject(code: MediaErrorCode, message: string): DomainValidationException {
    return new DomainValidationException(fileError(code, message), message);
  }

  private toResponse(media: Media): MediaResponse {
    // Thư viện CMS dùng URL đã ký: xem được cả media chưa gắn vào revision public.
    return toMediaResponse(media, this.urls.signedUrl(media.storageKey));
  }
}
