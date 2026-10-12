import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { ModerationService } from '../services/moderation.service';

@ApiTags('Admin · Moderation')
@ApiBearerAuth()
@Controller('exhibits')
export class ExhibitRevisionsController {
  constructor(private readonly moderation: ModerationService) {}

  @Get(':id/revisions')
  @Permissions(PERMISSIONS.EXHIBIT_READ)
  @ApiOperation({ summary: 'Lịch sử phiên bản của một hiện vật' })
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.moderation.history(id);
  }
}
