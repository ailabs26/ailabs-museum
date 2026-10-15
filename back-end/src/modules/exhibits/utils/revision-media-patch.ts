import { BadRequestException } from '@nestjs/common';
import { MediaReference } from '../../media/services/media-reference.validator';
import {
  REVISION_MEDIA_SLOTS,
  RevisionMediaColumn,
  RevisionMediaDtoField,
} from '../constants/revision-media-slots';

/** Field media mà DTO create/update nhận (kể cả alias cũ `audioId`). */
export type RevisionMediaInput = Partial<Record<RevisionMediaDtoField | 'audioId', string | null>>;

/** Giá trị mới cho các cột media; cột không có mặt = giữ nguyên. */
export type RevisionMediaPatch = Partial<Record<RevisionMediaColumn, string | null>>;

/**
 * Chuyển field media trên DTO thành patch cột (FR-55–57):
 * - field vắng mặt (`undefined`) → giữ nguyên;
 * - `null` → tháo media khỏi revision (không xóa file media);
 * - UUID → gắn/thay.
 * `audioId` (cũ) là alias của `audioViId`; gửi cả hai với giá trị khác nhau → 400.
 */
export function resolveRevisionMediaPatch(input: RevisionMediaInput): RevisionMediaPatch {
  const { audioId, audioViId } = input;
  if (audioId !== undefined && audioViId !== undefined && audioId !== audioViId) {
    throw new BadRequestException({
      message: 'audioId (cũ) và audioViId mâu thuẫn',
      errors: [
        {
          field: 'audioViId',
          code: 'audio_alias_conflict',
          message: 'audioId là tên cũ của audioViId; chỉ gửi một trong hai hoặc cùng giá trị',
        },
      ],
    });
  }

  const resolved: RevisionMediaInput = { ...input, audioViId: audioViId !== undefined ? audioViId : audioId };
  const patch: RevisionMediaPatch = {};
  for (const slot of REVISION_MEDIA_SLOTS) {
    const value = resolved[slot.dtoField];
    if (value !== undefined) patch[slot.column] = value;
  }
  return patch;
}

/** Tham chiếu cần kiểm tra cho các cột media đang có giá trị (bỏ cột trống/không đổi). */
export function mediaReferencesOf(values: RevisionMediaPatch): MediaReference[] {
  return REVISION_MEDIA_SLOTS.flatMap((slot) => {
    const mediaId = values[slot.column];
    return mediaId ? [{ field: slot.dtoField, kind: slot.kind, mediaId }] : [];
  });
}

/** Sao chép đủ các cột media của một revision (dùng khi fork revision mới). */
export function pickRevisionMedia(revision: Partial<Record<RevisionMediaColumn, string | null>>): Record<RevisionMediaColumn, string | null> {
  return Object.fromEntries(
    REVISION_MEDIA_SLOTS.map((slot) => [slot.column, revision[slot.column] ?? null]),
  ) as Record<RevisionMediaColumn, string | null>;
}
