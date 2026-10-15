import { Media, MediaKind, MediaProcessingState } from '../entities/media.entity';

export const MAX_MODEL_BYTES = 128 * 1024 * 1024;
export function isSafeModelKey(key: string): boolean {
  return key.length <= 512 && /^[a-zA-Z0-9_/-]+\.glb$/.test(key)
    && key.split('/').every((part) => part.length > 0 && part !== '.' && part !== '..');
}

/** Stable API URL: credentials and expiring Storage URLs stay on the server. */
export function toPublicModel(media: Media | null | undefined, slug: string, exhibitId: string) {
  if (!media || media.isDeleted || media.processingState !== MediaProcessingState.READY
    || media.kind !== MediaKind.MODEL || !isSafeModelKey(media.storageKey)
    || !/^[a-f0-9]{64}$/.test(media.checksumSha256)
    || !Number.isSafeInteger(Number(media.sizeBytes)) || Number(media.sizeBytes) <= 0
    || Number(media.sizeBytes) > MAX_MODEL_BYTES) return null;
  return {
    id: media.id, storageKey: media.storageKey, sizeBytes: Number(media.sizeBytes),
    checksumSha256: media.checksumSha256,
    url: `/rooms/${encodeURIComponent(slug)}/exhibits/${encodeURIComponent(exhibitId)}/model?version=${media.checksumSha256}`,
  };
}
export type PublicModel = NonNullable<ReturnType<typeof toPublicModel>>;
