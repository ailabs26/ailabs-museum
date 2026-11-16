import {
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { auditClientInfo } from '../../audit/audit-request.util';
import { Audit } from '../../audit/decorators/audit.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { UploadMediaDto } from '../dto/upload-media.dto';
import { MediaUploadJobService } from '../services/media-upload-job.service';
import { UploadedMediaFile } from '../services/media.service';
import { MediaFileInterceptor } from '../interceptors/media-file.interceptor';

/** Upload media bất đồng bộ: tạo job rồi hỏi trạng thái (VT-078). */
@ApiTags('Admin · Media')
@ApiBearerAuth()
@Controller('admin/media/upload-jobs')
export class AdminUploadJobsController {
  constructor(private readonly jobs: MediaUploadJobService) {}

  @Post()
  @Permissions(PERMISSIONS.MEDIA_UPLOAD)
  @Audit('media.upload_job.create', 'media_upload_job')
  @UseInterceptors(MediaFileInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: '1–128 ký tự [A-Za-z0-9_-]; gửi lại cùng key → nhận lại job cũ' })
  @ApiOperation({ summary: 'Tạo job upload media (202); retry cùng Idempotency-Key trả lại job cũ (200)' })
  async create(
    @UploadedFile() file: UploadedMediaFile | undefined,
    @Body() dto: UploadMediaDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { job, created } = await this.jobs.enqueue(file, dto, actorId, idempotencyKey, auditClientInfo(req));
    res.status(created ? HttpStatus.ACCEPTED : HttpStatus.OK);
    return job;
  }

  @Get(':id')
  @Permissions(PERMISSIONS.MEDIA_UPLOAD)
  @ApiOperation({ summary: 'Trạng thái và tiến trình của job upload (chỉ người tạo xem được)' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') actorId: string) {
    return this.jobs.getForActor(id, actorId);
  }
}
