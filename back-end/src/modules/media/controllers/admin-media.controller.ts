import { pipeline } from 'node:stream';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Audit } from '../../audit/decorators/audit.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { BulkIdsDto } from '../../../common/dto/bulk-ids.dto';
import { ListMediaQueryDto } from '../dto/list-media-query.dto';
import { MEDIA_TEXT_LIMITS, UpdateMediaDto } from '../dto/update-media.dto';
import { UploadMediaDto } from '../dto/upload-media.dto';
import { MediaKind } from '../entities/media.entity';
import { MediaFileInterceptor } from '../interceptors/media-file.interceptor';
import { MediaService, UploadedMediaFile } from '../services/media.service';

// Giới hạn multer nằm cùng MediaFileInterceptor; giữ export cũ cho nơi đang import từ controller.
export { MEDIA_UPLOAD_LIMITS } from '../interceptors/media-file.interceptor';

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
  @ApiOperation({ summary: 'Thư viện media (phân trang, lọc kind/state, tìm theo tên & metadata; deleted=true → thùng rác)' })
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
  @UseInterceptors(MediaFileInterceptor())
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

  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.MEDIA_UPLOAD)
  @Audit('media.delete', 'media')
  @ApiOperation({ summary: 'Xóa mềm nhiều media (tất cả hoặc không; BR-21, 409 kèm lý do từng ID; giữ file)' })
  removeMany(@Body() dto: BulkIdsDto) {
    return this.mediaService.removeMany(dto.ids);
  }

  @Post('bulk-restore')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.MEDIA_UPLOAD)
  @Audit('media.restore', 'media')
  @ApiOperation({ summary: 'Khôi phục media đã xóa mềm (tất cả hoặc không; 409 kèm lý do từng ID)' })
  restoreMany(@Body() dto: BulkIdsDto) {
    return this.mediaService.restoreMany(dto.ids);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.MEDIA_UPLOAD)
  @Audit('media.delete', 'media')
  @ApiOperation({ summary: 'Xóa mềm media, giữ file (409 nếu exhibit đã xuất bản đang dùng — BR-21)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.mediaService.remove(id);
  }
}
