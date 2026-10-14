import { MediaKind } from '../entities/media.entity';

/** 1 MB = 1.000.000 byte theo định nghĩa SRS (Mục 5.2). */
export const MEGABYTE = 1_000_000;

/** Định dạng file được phép upload (Mục 5.2 SRS — Engineering Target v0.1). */
export enum MediaFormat {
  GLB = 'glb',
  JPEG = 'jpeg',
  PNG = 'png',
  WEBP = 'webp',
  MP3 = 'mp3',
  VTT = 'vtt',
}

export interface MediaFormatSpec {
  format: MediaFormat;
  kind: MediaKind;
  /** MIME lưu DB và trả về client — xác định từ nội dung, không lấy từ header client. */
  mimeType: string;
  /** Phần mở rộng dùng khi đặt storage key. */
  extension: string;
  maxBytes: number;
  label: string;
}

export const MEDIA_FORMAT_SPECS: Readonly<Record<MediaFormat, MediaFormatSpec>> = {
  [MediaFormat.GLB]: {
    format: MediaFormat.GLB,
    kind: MediaKind.MODEL,
    mimeType: 'model/gltf-binary',
    extension: 'glb',
    maxBytes: 10 * MEGABYTE,
    label: 'Model 3D (GLB)',
  },
  [MediaFormat.JPEG]: {
    format: MediaFormat.JPEG,
    kind: MediaKind.IMAGE,
    mimeType: 'image/jpeg',
    extension: 'jpg',
    maxBytes: 2 * MEGABYTE,
    label: 'Hình ảnh JPEG',
  },
  [MediaFormat.PNG]: {
    format: MediaFormat.PNG,
    kind: MediaKind.IMAGE,
    mimeType: 'image/png',
    extension: 'png',
    maxBytes: 2 * MEGABYTE,
    label: 'Hình ảnh PNG',
  },
  [MediaFormat.WEBP]: {
    format: MediaFormat.WEBP,
    kind: MediaKind.IMAGE,
    mimeType: 'image/webp',
    extension: 'webp',
    maxBytes: 2 * MEGABYTE,
    label: 'Hình ảnh WebP',
  },
  [MediaFormat.MP3]: {
    format: MediaFormat.MP3,
    kind: MediaKind.AUDIO,
    mimeType: 'audio/mpeg',
    extension: 'mp3',
    maxBytes: 10 * MEGABYTE,
    label: 'Âm thanh MP3',
  },
  [MediaFormat.VTT]: {
    format: MediaFormat.VTT,
    kind: MediaKind.SUBTITLE,
    mimeType: 'text/vtt',
    extension: 'vtt',
    maxBytes: 1 * MEGABYTE,
    label: 'Phụ đề WebVTT',
  },
};

/** Trần dung lượng cho tầng nhận file (multer) — bằng giới hạn lớn nhất trong các định dạng. */
export const MAX_UPLOAD_BYTES = Math.max(
  ...Object.values(MEDIA_FORMAT_SPECS).map((spec) => spec.maxBytes),
);
