import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ApiError } from '../../../common/dto/api-response';
import { DomainValidationException } from '../../../common/exceptions/validation.exception';
import { Media, MediaKind, MediaProcessingState } from '../entities/media.entity';
import { MediaRepository } from '../repositories/media.repository';

/** Một tham chiếu media cần kiểm tra: field trên DTO, kind bắt buộc và id media. */
export interface MediaReference {
  field: string;
  kind: MediaKind;
  mediaId: string;
}

export type MediaReferenceErrorCode = 'media_not_found' | 'media_not_ready' | 'media_kind_mismatch';

const KIND_LABELS: Record<MediaKind, string> = {
  [MediaKind.MODEL]: 'model 3D',
  [MediaKind.IMAGE]: 'hình ảnh',
  [MediaKind.AUDIO]: 'audio',
  [MediaKind.SUBTITLE]: 'phụ đề',
};

/**
 * Kiểm tra thuần (không I/O) danh sách tham chiếu với các bản ghi media tìm được.
 * Media đã xóa mềm được báo như không tồn tại để không lộ thông tin thừa.
 */
export function checkMediaReferences(
  references: readonly MediaReference[],
  mediaById: ReadonlyMap<string, Media>,
): ApiError[] {
  return references.flatMap(({ field, kind, mediaId }): ApiError[] => {
    const media = mediaById.get(mediaId);
    if (!media || media.isDeleted) {
      return [{ field, code: 'media_not_found', message: `Không tìm thấy media '${mediaId}'` }];
    }
    if (media.processingState !== MediaProcessingState.READY) {
      return [
        {
          field,
          code: 'media_not_ready',
          message: `Media '${mediaId}' chưa sẵn sàng (trạng thái: ${media.processingState}), không thể gắn vào nội dung`,
        },
      ];
    }
    if (media.kind !== kind) {
      return [
        {
          field,
          code: 'media_kind_mismatch',
          message: `Media '${mediaId}' là ${KIND_LABELS[media.kind]}, không dùng được cho ô ${KIND_LABELS[kind]}`,
        },
      ];
    }
    return [];
  });
}

/**
 * Kiểm tra media được gắn vào nội dung (FR-55–57, §5.2): tồn tại, chưa xóa, đã xử lý xong
 * (`ready`) và đúng loại. Các dòng media được khóa `FOR SHARE` trong transaction của
 * caller: thao tác xóa media (khóa `FOR UPDATE`) phải chờ transaction này kết thúc, nên
 * không thể xóa media giữa lúc kiểm tra và lúc ghi tham chiếu.
 */
@Injectable()
export class MediaReferenceValidator {
  constructor(private readonly mediaRepo: MediaRepository) {}

  /** Khóa + kiểm tra; trả lỗi (nếu có) và các bản ghi media đã khóa theo id. */
  async lockAndCheck(
    references: readonly MediaReference[],
    manager: EntityManager,
  ): Promise<{ errors: ApiError[]; mediaById: Map<string, Media> }> {
    if (references.length === 0) return { errors: [], mediaById: new Map() };

    const ids = references.map((reference) => reference.mediaId);
    const rows = await this.mediaRepo.lockByIds(ids, manager);
    const mediaById = new Map(rows.map((media) => [media.id, media]));
    return { errors: checkMediaReferences(references, mediaById), mediaById };
  }

  /** Như `lockAndCheck` nhưng ném 422 nếu có tham chiếu không hợp lệ. */
  async assertAttachable(references: readonly MediaReference[], manager: EntityManager): Promise<void> {
    const { errors } = await this.lockAndCheck(references, manager);
    if (errors.length > 0) {
      throw new DomainValidationException(errors, 'Media đính kèm không hợp lệ');
    }
  }
}
