import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { ListQueueQueryDto } from '../dto/list-queue-query.dto';
import { ModerationService } from '../services/moderation.service';

@ApiTags('Admin · Moderation')
@ApiBearerAuth()
@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get('queue')
  @Permissions(PERMISSIONS.REVISION_PUBLISH)
  @ApiOperation({ summary: 'Hàng chờ kiểm duyệt (revision in_review)' })
  queue(@Query() query: ListQueueQueryDto) {
    return this.moderation.queue(query);
  }

  @Get('revisions/:id')
  @Permissions(PERMISSIONS.EXHIBIT_READ)
  @ApiOperation({ summary: 'Chi tiết một phiên bản nội dung' })
  getRevision(@Param('id', ParseUUIDPipe) id: string) {
    return this.moderation.getRevision(id);
  }

  @Get('revisions/:id/diff')
  @Permissions(PERMISSIONS.EXHIBIT_READ)
  @ApiOperation({ summary: 'So sánh phiên bản này với bản đang xuất bản' })
  diff(@Param('id', ParseUUIDPipe) id: string) {
    return this.moderation.diff(id);
  }
}
