import { pipeline } from 'node:stream';
import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { MediaKind } from '../entities/media.entity';
import { MediaDeliveryService } from '../services/media-delivery.service';
import { ByteRange } from '../storage/media-storage-driver';

/** Đường dẫn phân phối file (ngoài prefix /api — xem `main.ts`). */
export const MEDIA_DELIVERY_ROUTE = 'media/uploads/:directory/:fileName';

const NOT_FOUND_MESSAGE = 'Không tìm thấy media';

/**
 * Phân phối file media đã upload (stream từ driver lưu trữ: đĩa hoặc Supabase Storage).
 * Chỉ trả file được revision public hiện hành tham chiếu hoặc có URL đã ký (Preview).
 *
 * Header an toàn: Content-Type lấy từ DB (đã kiểm tra nội dung khi upload), `nosniff`,
 * CSP `sandbox` (mở trực tiếp file cũng không chạy được script), ETag = SHA-256 nội dung.
 * `Cache-Control: no-cache` buộc trình duyệt/CDN hỏi lại mỗi lần (304 nếu không đổi), nên
 * Hide/Unpublish có hiệu lực ngay với request mới (BR-22, AC-51). URL đã ký: `no-store`.
 * Hỗ trợ Range (GLTFLoader/audio seek) và HEAD. Lỗi (404/416) không mang các header này.
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
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const delivery = await this.delivery.resolve({ directory, fileName, expires, signature });
    if (!delivery) throw new NotFoundException(NOT_FOUND_MESSAGE);

    const { media, viaSignature } = delivery;
    const size = Number(media.sizeBytes);
    const etag = `"${media.checksumSha256}"`;
    const headers = {
      'Content-Type': media.kind === MediaKind.SUBTITLE ? 'text/vtt; charset=utf-8' : media.mimeType,
      ETag: etag,
      'Cache-Control': viaSignature ? 'private, no-store' : 'no-cache',
      'Accept-Ranges': 'bytes',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'cross-origin',
    };

    if (isNotModified(req, etag)) {
      res.status(HttpStatus.NOT_MODIFIED).set(headers).end();
      return;
    }

    const range = parseRange(req, size);
    const stream = await this.delivery.open(media, range);
    if (!stream) {
      this.logger.error(`File của media ${media.id} không còn trong kho lưu trữ`);
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }

    // Client đã ngắt trong lúc chờ kho lưu trữ (đóng modal, hủy fetch): pipeline vào response đã
    // đóng sẽ ném lỗi TRƯỚC khi gắn listener cho stream nguồn, rồi lỗi muộn của upstream (vd HTTP/2
    // reset từ Supabase) không ai bắt và làm sập process. Hủy stream nguồn và dừng ở đây.
    if (res.destroyed || res.writableEnded) {
      stream.destroy();
      return;
    }

    res.set(headers);
    if (range) {
      res.status(HttpStatus.PARTIAL_CONTENT).set('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
    }
    res.set('Content-Length', String(range ? range.end - range.start + 1 : size));

    if (req.method === 'HEAD') {
      stream.destroy();
      res.end();
      return;
    }

    pipeline(stream, res, (error?: NodeJS.ErrnoException | null) => {
      // Client ngắt kết nối giữa chừng (seek audio, đóng tab) là bình thường.
      if (error && error.code !== 'ERR_STREAM_PREMATURE_CLOSE' && error.code !== 'ECONNRESET') {
        this.logger.warn(`Gửi media ${media.id} bị gián đoạn: ${error.message}`);
      }
    });
  }
}

/** `If-None-Match` khớp ETag hiện tại (so sánh yếu, hỗ trợ danh sách và `*`). */
function isNotModified(req: Request, etag: string): boolean {
  const header = req.headers['if-none-match'];
  if (!header) return false;
  if (/(?:^|,)\s*no-cache\s*(?:,|$)/.test(req.headers['cache-control'] ?? '')) return false;
  return header.split(',').some((tag) => {
    const value = tag.trim();
    return value === '*' || value.replace(/^W\//, '') === etag;
  });
}

/**
 * Đọc header Range: trả đoạn byte khi hợp lệ, `undefined` để gửi cả file (không có Range,
 * Range sai cú pháp hoặc nhiều đoạn), ném 416 khi đoạn nằm ngoài kích thước file.
 */
function parseRange(req: Request, size: number): ByteRange | undefined {
  if (!req.headers.range) return undefined;
  const ranges = req.range(size, { combine: true });
  if (ranges === -1) {
    throw new HttpException('Đoạn byte yêu cầu nằm ngoài kích thước file', HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
  }
  if (ranges === undefined || ranges === -2 || ranges.type !== 'bytes' || ranges.length !== 1) return undefined;
  return { start: ranges[0].start, end: ranges[0].end };
}
