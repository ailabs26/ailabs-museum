import {
  Controller,
  Get,
  HttpException,
  Logger,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { MediaKind } from '../entities/media.entity';
import { MediaDeliveryService } from '../services/media-delivery.service';

/** Đường dẫn phân phối file (ngoài prefix /api — xem `main.ts`). */
export const MEDIA_DELIVERY_ROUTE = 'media/uploads/:directory/:fileName';

const NOT_FOUND_MESSAGE = 'Không tìm thấy media';

/**
 * Phân phối file media đã upload, thay cho `express.static`.
 * Chỉ trả file được revision public hiện hành tham chiếu hoặc có URL đã ký (Preview).
 *
 * Header an toàn: Content-Type lấy từ DB (đã kiểm tra nội dung khi upload), `nosniff`,
 * CSP `sandbox` (mở trực tiếp file cũng không chạy được script), ETag = SHA-256 nội dung.
 * `Cache-Control: no-cache` buộc trình duyệt/CDN hỏi lại mỗi lần (304 nếu không đổi), nên
 * Hide/Unpublish có hiệu lực ngay với request mới (BR-22, AC-51). URL đã ký: `no-store`.
 */
@ApiExcludeController()
@Public()
@Controller()
export class MediaDeliveryController {
  private readonly logger = new Logger(MediaDeliveryController.name);

  constructor(private readonly delivery: MediaDeliveryService) {}

  @Get(MEDIA_DELIVERY_ROUTE)
  async serve(
    @Param('directory') directory: string,
    @Param('fileName') fileName: string,
    @Query('exp') expires: unknown,
    @Query('sig') signature: unknown,
    @Res() res: Response,
  ): Promise<void> {
    const delivery = await this.delivery.resolve({ directory, fileName, expires, signature });
    if (!delivery) throw new NotFoundException(NOT_FOUND_MESSAGE);

    const { media, filePath, viaSignature } = delivery;
    const contentType = media.kind === MediaKind.SUBTITLE ? 'text/vtt; charset=utf-8' : media.mimeType;

    await new Promise<void>((resolve, reject) => {
      res.sendFile(
        filePath,
        {
          dotfiles: 'deny',
          acceptRanges: true,
          cacheControl: false,
          lastModified: false,
          etag: false,
          // Chỉ áp dụng khi bắt đầu gửi file: lỗi (404/416) sẽ không mang các header này.
          headers: {
            'Content-Type': contentType,
            ETag: `"${media.checksumSha256}"`,
            'Cache-Control': viaSignature ? 'private, no-store' : 'no-cache',
            'Content-Disposition': 'inline',
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "default-src 'none'; sandbox",
            'Cross-Origin-Resource-Policy': 'cross-origin',
          },
        },
        (error?: Error & { status?: number; code?: string }) => {
          if (!error) return resolve();
          if (res.headersSent) {
            // Client ngắt kết nối giữa chừng (seek audio, đóng tab): không còn gì để trả.
            if (error.code !== 'ECONNABORTED' && error.code !== 'ECONNRESET') {
              this.logger.warn(`Gửi media ${media.id} bị gián đoạn: ${error.message}`);
            }
            return resolve();
          }
          if (error.code === 'ENOENT' || error.status === 404) {
            this.logger.error(`File của media ${media.id} không còn trên đĩa`);
            return reject(new NotFoundException(NOT_FOUND_MESSAGE));
          }
          if (error.status && error.status >= 400 && error.status < 500) {
            // 412/416 từ xử lý Range / điều kiện.
            return reject(new HttpException(error.message, error.status));
          }
          return reject(error);
        },
      );
    });
  }
}
