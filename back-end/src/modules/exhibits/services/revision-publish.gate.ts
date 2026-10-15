import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ApiError } from '../../../common/dto/api-response';
import { DomainValidationException } from '../../../common/exceptions/validation.exception';
import { Media } from '../../media/entities/media.entity';
import { MediaReferenceValidator } from '../../media/services/media-reference.validator';
import { ContentLocale, REVISION_MEDIA_SLOTS } from '../constants/revision-media-slots';
import { validateForPublish } from '../dto/publish-validation.dto';
import { ExhibitRevision } from '../entities/exhibit-revision.entity';
import { resolveBilingual } from '../utils/bilingual';
import { mediaReferencesOf, pickRevisionMedia } from '../utils/revision-media-patch';

/** Giới hạn transcript theo §5.2. */
export const TRANSCRIPT_MAX_LENGTH = 20_000;

const RIGHTS_FIELDS = ['source', 'author', 'license'] as const;
const LOCALES: readonly ContentLocale[] = ['vi', 'en'];

type RevisionForPublish = Pick<ExhibitRevision, 'content' | 'hotspots'> &
  Partial<Pick<ExhibitRevision, (typeof REVISION_MEDIA_SLOTS)[number]['column']>>;

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

function slotOf(key: (typeof REVISION_MEDIA_SLOTS)[number]['key']) {
  return REVISION_MEDIA_SLOTS.find((slot) => slot.key === key)!;
}

/**
 * Luật nội dung §5.2 (tên/mô tả song ngữ, transform, hotspot) — tái dùng `validateForPublish`.
 * Media được kiểm riêng ở `checkMediaForPublish` (theo từng ngôn ngữ), nên không truyền
 * `audioId`/`imageId` vào đây. Thông báo dạng "field: nội dung" được tách thành ApiError.
 */
export function checkContentForPublish(revision: RevisionForPublish): ApiError[] {
  const content = (revision.content ?? {}) as unknown as Record<string, unknown>;
  const result = validateForPublish({
    name: resolveBilingual(content.name),
    description: resolveBilingual(content.description),
    position: content.position as never,
    rotation: content.rotation as never,
    scale: content.scale as never,
    hotspots: (revision.hotspots ?? []).map((hotspot) => ({
      label: resolveBilingual(hotspot.label),
      body: resolveBilingual(hotspot.body),
      positionX: Number(hotspot.positionX),
      positionY: Number(hotspot.positionY),
      positionZ: Number(hotspot.positionZ),
    })),
  });
  return result.errors.map((error) => {
    const separator = error.indexOf(': ');
    return separator > 0
      ? { field: error.slice(0, separator), code: 'publish_content_invalid', message: error.slice(separator + 2) }
      : { code: 'publish_content_invalid', message: error };
  });
}

/**
 * Luật media khi Submit Review/Publish (§5.2, FR-57, FR-97). Chỉ áp dụng cho media đã qua
 * kiểm tra tham chiếu (tồn tại/ready/đúng loại) — có trong `mediaById`.
 */
export function checkMediaForPublish(
  revision: RevisionForPublish,
  mediaById: ReadonlyMap<string, Media>,
): ApiError[] {
  const errors: ApiError[] = [];
  const columns = pickRevisionMedia(revision);
  const content = (revision.content ?? {}) as unknown as Record<string, unknown>;

  // FR-97: mọi media được dùng phải đủ nguồn, tác giả/chủ sở hữu, giấy phép.
  for (const slot of REVISION_MEDIA_SLOTS) {
    const media = columns[slot.column] ? mediaById.get(columns[slot.column]!) : undefined;
    if (!media) continue;
    const missing = RIGHTS_FIELDS.filter((field) => !hasText(media[field]));
    if (missing.length > 0) {
      errors.push({
        field: slot.dtoField,
        code: 'media_rights_missing',
        message: `Media '${media.id}' thiếu thông tin quyền sử dụng: ${missing.join(', ')}`,
      });
    }
  }

  // Hình ảnh có nội dung phải có alt text tiếng Việt và tiếng Anh.
  if (columns.imageMediaId) {
    const altText = resolveBilingual(content.altText);
    for (const locale of LOCALES) {
      if (!altText[locale]) {
        errors.push({
          field: `altText.${locale}`,
          code: 'image_alt_text_missing',
          message: `Hình ảnh đính kèm bắt buộc có alt text (${locale})`,
        });
      }
    }
  }

  // Mỗi audio được gắn phải có transcript và phụ đề cùng ngôn ngữ; phụ đề không đứng một mình.
  const transcript = resolveBilingual(content.transcript);
  for (const locale of LOCALES) {
    const audio = slotOf(locale === 'vi' ? 'audioVi' : 'audioEn');
    const subtitle = slotOf(locale === 'vi' ? 'subtitleVi' : 'subtitleEn');
    const hasAudio = Boolean(columns[audio.column]);
    const hasSubtitle = Boolean(columns[subtitle.column]);

    if (hasAudio && !transcript[locale]) {
      errors.push({
        field: `transcript.${locale}`,
        code: 'audio_transcript_missing',
        message: `Audio (${locale}) bắt buộc có transcript cùng ngôn ngữ`,
      });
    }
    if (hasAudio && !hasSubtitle) {
      errors.push({
        field: subtitle.dtoField,
        code: 'audio_subtitle_missing',
        message: `Audio (${locale}) bắt buộc có phụ đề WebVTT cùng ngôn ngữ`,
      });
    }
    if (!hasAudio && hasSubtitle) {
      errors.push({
        field: subtitle.dtoField,
        code: 'subtitle_without_audio',
        message: `Phụ đề (${locale}) chỉ dùng được khi có audio cùng ngôn ngữ`,
      });
    }
    const text = transcript[locale];
    if (text && text.length > TRANSCRIPT_MAX_LENGTH) {
      errors.push({
        field: `transcript.${locale}`,
        code: 'transcript_too_long',
        message: `Transcript (${locale}) tối đa ${TRANSCRIPT_MAX_LENGTH.toLocaleString('vi-VN')} ký tự`,
      });
    }
  }

  return errors;
}

/**
 * Cổng kiểm tra trước Submit Review và Publish (§5.1, §5.2): nội dung + media.
 * Phải gọi TRONG transaction thực hiện chuyển trạng thái, trước mọi lệnh ghi: các dòng
 * media được khóa `FOR SHARE` nên không thể bị xóa cho tới khi transaction kết thúc.
 */
@Injectable()
export class RevisionPublishGate {
  constructor(private readonly mediaReferences: MediaReferenceValidator) {}

  async assertPublishable(revision: RevisionForPublish, manager: EntityManager): Promise<void> {
    const references = mediaReferencesOf(pickRevisionMedia(revision));
    const { errors: referenceErrors, mediaById } = await this.mediaReferences.lockAndCheck(
      references,
      manager,
    );
    // Slot đã lỗi tham chiếu thì không báo thêm lỗi quyền sử dụng cho cùng slot.
    const invalidFields = new Set(referenceErrors.map((error) => error.field));
    const usableMedia = new Map(
      references
        .filter((reference) => !invalidFields.has(reference.field))
        .flatMap((reference) => {
          const media = mediaById.get(reference.mediaId);
          return media ? [[reference.mediaId, media] as const] : [];
        }),
    );

    const errors = [
      ...checkContentForPublish(revision),
      ...referenceErrors,
      ...checkMediaForPublish(revision, usableMedia),
    ];
    if (errors.length > 0) {
      throw new DomainValidationException(errors, 'Phiên bản chưa đủ điều kiện để gửi duyệt/xuất bản');
    }
  }
}
