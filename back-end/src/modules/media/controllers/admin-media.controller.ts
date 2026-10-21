import { pipeline } from 'node:stream';
import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Audit } from '../../audit/decorators/audit.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { ListMediaQueryDto } from '../dto/list-media-query.dto';
import { MEDIA_TEXT_LIMITS, UpdateMediaDto } from '../dto/update-media.dto';
import { UploadMediaDto } from '../dto/upload-media.dto';
import { MediaKind } from '../entities/media.entity';
import { MAX_UPLOAD_BYTES } from '../inspection/media-formats';
import { MediaService, UploadedMediaFile } from '../services/media.service';

/**
 * Giới hạn tầng nhận file → multer trả 413 khi vượt. Busboy coi file dài ĐÚNG bằng
 * `fileSize` là vượt giới hạn, nên cộng 1 byte để file đúng 10 MB (SRS: "≤ 10 MB") vẫn
 * qua được; giới hạn chính xác theo định dạng thực tế do MediaService kiểm tra.
 */
export const MEDIA_UPLOAD_LIMITS = {
  fileSize: MAX_UPLOAD_BYTES + 1,
  files: 1,
  fields: 10,
  fieldSize: 16 * 1024,
  parts: 12,
};

const UPLOAD_BODY_SCHEMA = {
  type: 'object',
  required: ['file'],
  properties: {
    file: { type: 'string', format: 'binary', description: 'GLB ≤ 10 MB, JPEG/PNG/WebP ≤ 2 MB, MP3 ≤ 10 MB, WebVTT ≤ 1 MB' },
    kind: { type: 'string', enum: Object.values(MediaKind) },
    altText: { type: 'string', maxLength: MEDIA_TEXT_LIMITS.altText },
    source: { type: 'string', maxLength: MEDIA_TEXT_LIMITS.source },
    author: { type: 'string', maxLength: MEDIA_TEXT_LIMITS.author },
    license: { type: 'string', maxLength: MEDIA_TEXT_LIMITS.license },
  },
};

/**
 * Quản lý media cho Admin CMS (FR-55–57). Mọi thao tác dùng quyền `media:upload`
 * (bộ quyền hiện có chưa tách đọc/xóa media).
 */
@ApiTags('Admin · Media')
@ApiBearerAuth()
@Controller('admin/media')
export class AdminMediaController {
  private readonly logger = new Logger(AdminMediaController.name);

  constructor(private readonly mediaService: MediaService) {}

  @Get()
  @Permissions(PERMISSIONS.MEDIA_UPLOAD)
  @ApiOperation({ summary: 'Thư viện media (phân trang, lọc kind/state, tìm theo tên & metadata)' })
  list(@Query() query: ListMediaQueryDto) {
    return this.mediaService.list(query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.MEDIA_UPLOAD)
  @ApiOperation({ summary: 'Chi tiết media theo UUID' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.mediaService.getById(id);
  }

  @Get(':id/content')
  @Permissions(PERMISSIONS.MEDIA_UPLOAD)
  @ApiOperation({ summary: 'Nội dung file media (cần đăng nhập) — cho công cụ CMS đọc file, kể cả file seed' })
  async content(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response): Promise<void> {
    const { media, stream } = await this.mediaService.openContent(id);
    // Client đã ngắt trong lúc chờ kho lưu trữ: không pipe vào response đã đóng (xem MediaDeliveryController).
    if (res.destroyed || res.writableEnded) {
      stream.destroy();
      return;
    }
    res.set({
      'Content-Type': media.mimeType,
      'Content-Length': String(media.sizeBytes),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    });
    pipeline(stream, res, (error?: NodeJS.ErrnoException | null) => {
      if (error && error.code !== 'ERR_STREAM_PREMATURE_CLOSE' && error.code !== 'ECONNRESET') {
        this.logger.warn(`Gửi nội dung media ${media.id} bị gián đoạn: ${error.message}`);
      }
    });
  }

  @Post('upload')
  @Permissions(PERMISSIONS.MEDIA_UPLOAD)
  @Audit('media.upload', 'media')
  @UseInterceptors(FileInterceptor('file', { limits: MEDIA_UPLOAD_LIMITS }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: UPLOAD_BODY_SCHEMA })
  @ApiOperation({ summary: 'Upload media — kiểm tra định dạng thực tế, dung lượng và cấu trúc file' })
  upload(
    @UploadedFile() file: UploadedMediaFile | undefined,
    @Body() dto: UploadMediaDto,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.mediaService.upload(file, dto, actorId ?? null);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.MEDIA_UPLOAD)
  @Audit('media.update', 'media')
  @ApiOperation({ summary: 'Cập nhật metadata (nguồn, tác giả, giấy phép, alt text) — không thay file' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMediaDto) {
    return this.mediaService.update(id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.MEDIA_UPLOAD)
  @Audit('media.delete', 'media')
  @ApiOperation({ summary: 'Xóa mềm media (409 nếu exhibit đã xuất bản đang dùng — BR-21)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.mediaService.remove(id);
  }
}
