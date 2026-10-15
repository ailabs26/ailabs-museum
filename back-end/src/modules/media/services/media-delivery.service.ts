import { Injectable } from '@nestjs/common';
import { Media } from '../entities/media.entity';
import { MediaRepository } from '../repositories/media.repository';
import { MediaStorageService } from './media-storage.service';
import { MediaUrlService } from './media-url.service';

/** Thư mục con hợp lệ trong vùng public — khớp `MediaStorageService.createKey`. */
export const DELIVERABLE_DIRECTORIES = ['models', 'images', 'audio', 'subtitles'] as const;

/** Tên file do server sinh: `<uuid>.<ext>` với đuôi thuộc danh sách định dạng đã hỗ trợ. */
const FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:glb|jpg|png|webp|mp3|vtt)$/;

export interface MediaDeliveryRequest {
  directory: string;
  fileName: string;
  /** Tham số `exp` / `sig` của URL đã ký (nếu có). */
  expires?: unknown;
  signature?: unknown;
}

export interface MediaDelivery {
  media: Media;
  filePath: string;
  /** `true` khi được phép nhờ URL đã ký (Preview), không phải vì media đang công khai. */
  viaSignature: boolean;
}

/**
 * Quyết định một file media có được phân phối hay không (FR-68, AC-36, AC-51):
 * - media phải tồn tại, chưa xóa mềm, `ready`;
 * - được ít nhất một revision Published hiện hành của hiện vật còn công khai tham chiếu,
 *   HOẶC request mang URL đã ký hợp lệ còn hạn (Preview CMS xem media của Draft).
 * Mọi trường hợp bị từ chối đều trả `null` để caller trả 404 — không phân biệt "không tồn
 * tại" với "không được phép", tránh lộ sự tồn tại của media chưa công khai.
 */
@Injectable()
export class MediaDeliveryService {
  constructor(
    private readonly mediaRepo: MediaRepository,
    private readonly storage: MediaStorageService,
    private readonly urls: MediaUrlService,
  ) {}

  async resolve(request: MediaDeliveryRequest, nowMs: number = Date.now()): Promise<MediaDelivery | null> {
    const { directory, fileName } = request;
    if (!(DELIVERABLE_DIRECTORIES as readonly string[]).includes(directory) || !FILE_NAME.test(fileName)) {
      return null;
    }
    const storageKey = `uploads/${directory}/${fileName}`;

    const media = await this.mediaRepo.findDeliverableByKey(storageKey);
    if (!media) return null;

    const hasSignature = request.expires !== undefined || request.signature !== undefined;
    let viaSignature = false;
    if (hasSignature) {
      // Có gửi chữ ký thì chữ ký phải hợp lệ; chữ ký sai không "rơi" về nhánh công khai
      // để URL ký giả/hết hạn luôn bị từ chối nhất quán.
      if (!this.urls.verify(storageKey, request.expires, request.signature, nowMs)) return null;
      viaSignature = true;
    } else if (!(await this.mediaRepo.isPubliclyReferenced(media.id))) {
      return null;
    }

    const filePath = this.storage.publicFilePath(storageKey);
    return filePath ? { media, filePath, viaSignature } : null;
  }
}
