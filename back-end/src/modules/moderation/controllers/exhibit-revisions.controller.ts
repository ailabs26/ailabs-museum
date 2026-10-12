import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { Audit } from '../../audit/decorators/audit.decorator';
import { HideExhibitDto } from '../dto/hide-exhibit.dto';
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

  @Post(':id/hide')
  @Permissions(PERMISSIONS.REVISION_HIDE)
  @Audit('exhibit.hide', 'exhibit')
  @ApiOperation({ summary: 'Tạm ẩn hiện vật khỏi public' })
  hide(@Param('id', ParseUUIDPipe) id: string, @Body() dto: HideExhibitDto) {
    return this.moderation.hide(id, dto);
  }

  @Post(':id/unhide')
  @Permissions(PERMISSIONS.REVISION_HIDE)
  @Audit('exhibit.unhide', 'exhibit')
  @ApiOperation({ summary: 'Hiện lại hiện vật' })
  unhide(@Param('id', ParseUUIDPipe) id: string, @Body() dto: HideExhibitDto) {
    return this.moderation.unhide(id, dto);
  }
}
