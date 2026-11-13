import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { AuthUser } from '../../../common/types/auth-user.type';
import { Audit } from '../../audit/decorators/audit.decorator';
import { PublishRevisionDto } from '../dto/publish-revision.dto';
import { RejectRevisionDto } from '../dto/reject-revision.dto';
import { ModerationService } from '../services/moderation.service';

@ApiTags('Admin · Moderation')
@ApiBearerAuth()
@Controller('revisions')
export class RevisionsController {
  constructor(private readonly moderation: ModerationService) {}

  @Post(':id/publish')
  @Permissions(PERMISSIONS.REVISION_PUBLISH)
  @Audit('revision.publish', 'revision')
  @ApiOperation({ summary: 'Xuất bản revision (in_review → approved)' })
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishRevisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.moderation.publish(id, dto, user);
  }

  @Post(':id/reject')
  @Permissions(PERMISSIONS.REVISION_REJECT)
  @Audit('revision.reject', 'revision')
  @ApiOperation({ summary: 'Từ chối revision kèm lý do (in_review → rejected)' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectRevisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.moderation.reject(id, dto, user);
  }
}
