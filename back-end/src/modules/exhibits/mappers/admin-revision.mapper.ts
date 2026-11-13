import { Media, MediaKind, MediaProcessingState } from '../../media/entities/media.entity';
import { User } from '../../users/entities/user.entity';
import {
  REVISION_MEDIA_SLOTS,
  RevisionMediaColumn,
  RevisionMediaSlotKey,
} from '../constants/revision-media-slots';
import { ExhibitRevision, RevisionState } from '../entities/exhibit-revision.entity';

/** Media của revision đang xem trong CMS/Preview. Không lộ storage key/checksum. */
export interface AdminRevisionMediaItem {
  id: string;
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  processingState: MediaProcessingState;
  isDeleted: boolean;
  /** URL đã ký (Preview xem được media của Draft); `null` nếu media đã xóa/không sẵn sàng. */
  url: string | null;
  originalName: string | null;
  altText: string | null;
  source: string | null;
  author: string | null;
  license: string | null;
}

export type AdminRevisionMedia = Record<RevisionMediaSlotKey, AdminRevisionMediaItem | null>;

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
}

/** Revision trả cho CMS — thay cho entity thô (entity kèm User có `passwordHash`). */
export interface AdminRevisionResponse {
  id: string;
  exhibitId: string;
  revisionNo: number;
  state: RevisionState;
  content: unknown;
  mediaIds: Record<RevisionMediaColumn, string | null>;
  media: AdminRevisionMedia;
  hotspots: Array<{
    id: string;
    label: string;
    body: string;
    positionX: number;
    positionY: number;
    positionZ: number;
    displayOrder: number;
  }>;
  createdById: string;
  createdBy: AdminUserSummary | null;
  reviewedById: string | null;
  reviewedBy: AdminUserSummary | null;
  reason: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}

/** Ký URL cho storage key (null nếu không phân phối được). */
export type SignedUrlBuilder = (storageKey: string) => string | null;

function toMediaItem(media: Media | null | undefined, signUrl: SignedUrlBuilder): AdminRevisionMediaItem | null {
  if (!media) return null;
  const deliverable = !media.isDeleted && media.processingState === MediaProcessingState.READY;
  return {
    id: media.id,
    kind: media.kind,
    mimeType: media.mimeType,
    sizeBytes: Number(media.sizeBytes),
    processingState: media.processingState,
    isDeleted: media.isDeleted,
    url: deliverable ? signUrl(media.storageKey) : null,
    originalName: media.originalName ?? null,
    altText: media.altText ?? null,
    source: media.source ?? null,
    author: media.author ?? null,
    license: media.license ?? null,
  };
}

export function toAdminUserSummary(user: User | null | undefined): AdminUserSummary | null {
  return user ? { id: user.id, name: user.displayName, email: user.email } : null;
}

/**
 * Media của đúng revision đang xem (AC-32: Preview dùng media của Draft). Slot có id nhưng
 * relation chưa nạp được trả `null` — caller phải nạp `REVISION_MEDIA_RELATIONS`.
 */
export function toAdminRevisionMedia(revision: ExhibitRevision, signUrl: SignedUrlBuilder): AdminRevisionMedia {
  return Object.fromEntries(
    REVISION_MEDIA_SLOTS.map((slot) => [slot.key, toMediaItem(revision[slot.relation], signUrl)]),
  ) as AdminRevisionMedia;
}

export function toAdminRevision(revision: ExhibitRevision, signUrl: SignedUrlBuilder): AdminRevisionResponse {
  return {
    id: revision.id,
    exhibitId: revision.exhibitId,
    revisionNo: revision.revisionNo,
    state: revision.state,
    content: revision.content,
    mediaIds: Object.fromEntries(
      REVISION_MEDIA_SLOTS.map((slot) => [slot.column, revision[slot.column] ?? null]),
    ) as Record<RevisionMediaColumn, string | null>,
    media: toAdminRevisionMedia(revision, signUrl),
    hotspots: [...(revision.hotspots ?? [])]
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .map((hotspot) => ({
        id: hotspot.id,
        label: hotspot.label,
        body: hotspot.body,
        positionX: Number(hotspot.positionX),
        positionY: Number(hotspot.positionY),
        positionZ: Number(hotspot.positionZ),
        displayOrder: hotspot.displayOrder,
      })),
    createdById: revision.createdById,
    createdBy: toAdminUserSummary(revision.createdBy),
    reviewedById: revision.reviewedById,
    reviewedBy: toAdminUserSummary(revision.reviewedBy),
    reason: revision.reason,
    createdAt: revision.createdAt,
    reviewedAt: revision.reviewedAt,
  };
}
