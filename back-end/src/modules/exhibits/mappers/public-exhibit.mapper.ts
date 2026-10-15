import { Media, MediaKind, MediaProcessingState } from '../../media/entities/media.entity';
import { Exhibit } from '../entities/exhibit.entity';
import { ExhibitRevision, RevisionState } from '../entities/exhibit-revision.entity';
import { Hotspot } from '../entities/hotspot.entity';
import { BilingualValue, primaryText, resolveBilingual } from '../utils/bilingual';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface PublicMediaRights {
  source: string | null;
  author: string | null;
  license: string | null;
}

/** Media công khai: URL tuyệt đối, không lộ storage key/checksum/người tạo. */
export interface PublicMediaDto {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  rights: PublicMediaRights;
}

export interface PublicImageDto extends PublicMediaDto {
  altText: BilingualValue;
}

export interface PublicAudioTrackDto {
  audio: PublicMediaDto;
  subtitle: PublicMediaDto | null;
  transcript: string | null;
}

export interface PublicLocalizedText {
  name: string | null;
  description: string | null;
  transcript: string | null;
}

export interface PublicHotspotDto {
  id: string;
  /** Bản tiếng Việt (thiếu thì tiếng Anh) — giữ contract cũ. */
  label: string;
  body: string;
  i18n: { vi: { label: string | null; body: string | null }; en: { label: string | null; body: string | null } };
  positionX: number;
  positionY: number;
  positionZ: number;
  displayOrder: number;
}

export interface PublicExhibitDto {
  id: string;
  roomId: string;
  displayOrder: number;
  /** Bản tiếng Việt (thiếu thì tiếng Anh) — giữ contract cũ cho FE hiện tại. */
  name: string;
  description: string;
  transcript: string | null;
  i18n: { vi: PublicLocalizedText; en: PublicLocalizedText };
  positionX: number;
  positionY: number;
  positionZ: number;
  rotation: Vector3;
  scale: Vector3;
  placeholderShape: string;
  placeholderColor: string;
  hotspots: PublicHotspotDto[];
  model: PublicMediaDto | null;
  image: PublicImageDto | null;
  /** Audio theo ngôn ngữ; `null` khi không có audio nào. Không tự thay audio ngôn ngữ khác (AC-08). */
  audio: { vi: PublicAudioTrackDto | null; en: PublicAudioTrackDto | null } | null;
}

/** Dựng URL tuyệt đối cho storage key (null nếu không phân phối được). */
export type MediaUrlBuilder = (storageKey: string) => string | null;

/** Báo slot media bị bỏ qua (media hỏng/đã xóa ngoài luồng) để log, không làm hỏng cả phòng. */
export type MediaSkipReporter = (exhibitId: string, mediaId: string, reason: string) => void;

const PLACEHOLDER_SHAPES = new Set(['box', 'sphere', 'cylinder', 'cone', 'torus']);
const HEX_COLOR = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;
const DEFAULT_SHAPE = 'box';
const DEFAULT_COLOR = '#8b7355';

function finiteOr(value: unknown, fallback: number): number {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) ? number : fallback;
}

function vector(value: unknown, fallback: number): Vector3 {
  const source = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return { x: finiteOr(source.x, fallback), y: finiteOr(source.y, fallback), z: finiteOr(source.z, fallback) };
}

/** Scale từng trục phải > 0; giá trị không hợp lệ quay về 1 thay vì làm mất hiện vật. */
function scale(value: unknown): Vector3 {
  const raw = vector(value, 1);
  return { x: raw.x > 0 ? raw.x : 1, y: raw.y > 0 ? raw.y : 1, z: raw.z > 0 ? raw.z : 1 };
}

function isFiniteNumberText(value: unknown): boolean {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number);
}

function toHotspot(hotspot: Hotspot): PublicHotspotDto | null {
  // Hotspot có tọa độ không hữu hạn bị loại để FE không nhận NaN (cả phòng sẽ fail validate).
  if (![hotspot.positionX, hotspot.positionY, hotspot.positionZ].every(isFiniteNumberText)) return null;
  const label = resolveBilingual(hotspot.label);
  const body = resolveBilingual(hotspot.body);
  return {
    id: hotspot.id,
    label: primaryText(label) ?? '',
    body: primaryText(body) ?? '',
    i18n: { vi: { label: label.vi, body: body.vi }, en: { label: label.en, body: body.en } },
    positionX: Number(hotspot.positionX),
    positionY: Number(hotspot.positionY),
    positionZ: Number(hotspot.positionZ),
    displayOrder: hotspot.displayOrder,
  };
}

/**
 * Ánh xạ hiện vật sang DTO công khai (FR-68). Chỉ revision APPROVED đang là bản published
 * hiện hành được trả; mọi revision khác (Draft/In Review/Rejected/lịch sử) → `null`.
 */
export function toPublicExhibit(
  exhibit: Exhibit,
  mediaUrl: MediaUrlBuilder,
  reportSkip: MediaSkipReporter = () => undefined,
): PublicExhibitDto | null {
  const revision: ExhibitRevision | null = exhibit.publishedRevision;
  if (
    !revision ||
    revision.state !== RevisionState.APPROVED ||
    revision.id !== exhibit.publishedRevisionId
  ) {
    return null;
  }

  const content = (revision.content ?? {}) as unknown as Record<string, unknown>;
  const name = resolveBilingual(content.name);
  const description = resolveBilingual(content.description);
  const transcript = resolveBilingual(content.transcript);
  const position = vector(content.position, 0);

  const media = (value: Media | null | undefined, kind: MediaKind): PublicMediaDto | null => {
    if (!value) return null;
    if (value.isDeleted || value.processingState !== MediaProcessingState.READY || value.kind !== kind) {
      reportSkip(exhibit.id, value.id, `media không còn hợp lệ (deleted=${value.isDeleted}, state=${value.processingState}, kind=${value.kind})`);
      return null;
    }
    const url = mediaUrl(value.storageKey);
    if (!url) {
      reportSkip(exhibit.id, value.id, 'media không có URL công khai');
      return null;
    }
    return {
      id: value.id,
      url,
      mimeType: value.mimeType,
      sizeBytes: Number(value.sizeBytes),
      rights: { source: value.source ?? null, author: value.author ?? null, license: value.license ?? null },
    };
  };

  const track = (
    audio: Media | null | undefined,
    subtitle: Media | null | undefined,
    text: string | null,
  ): PublicAudioTrackDto | null => {
    const audioDto = media(audio, MediaKind.AUDIO);
    return audioDto ? { audio: audioDto, subtitle: media(subtitle, MediaKind.SUBTITLE), transcript: text } : null;
  };

  const imageDto = media(revision.imageMedia, MediaKind.IMAGE);
  const audioVi = track(revision.audioMedia, revision.subtitleViMedia, transcript.vi);
  const audioEn = track(revision.audioEnMedia, revision.subtitleEnMedia, transcript.en);
  const placeholderShape = String(content.placeholderShape ?? '');
  const placeholderColor = String(content.placeholderColor ?? '');

  return {
    id: exhibit.id,
    roomId: exhibit.roomId,
    displayOrder: exhibit.displayOrder,
    name: primaryText(name) ?? '',
    description: primaryText(description) ?? '',
    transcript: primaryText(transcript),
    i18n: {
      vi: { name: name.vi, description: description.vi, transcript: transcript.vi },
      en: { name: name.en, description: description.en, transcript: transcript.en },
    },
    positionX: position.x,
    positionY: position.y,
    positionZ: position.z,
    rotation: vector(content.rotation, 0),
    scale: scale(content.scale),
    placeholderShape: PLACEHOLDER_SHAPES.has(placeholderShape) ? placeholderShape : DEFAULT_SHAPE,
    placeholderColor: HEX_COLOR.test(placeholderColor) ? placeholderColor : DEFAULT_COLOR,
    hotspots: (revision.hotspots ?? [])
      .flatMap((hotspot) => toHotspot(hotspot) ?? [])
      .sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id)),
    model: media(revision.modelMedia, MediaKind.MODEL),
    image: imageDto
      ? { ...imageDto, altText: resolveBilingual(content.altText) }
      : null,
    audio: audioVi || audioEn ? { vi: audioVi, en: audioEn } : null,
  };
}
