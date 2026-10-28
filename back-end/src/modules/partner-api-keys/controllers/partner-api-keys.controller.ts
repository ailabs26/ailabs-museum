import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit } from '../../audit/decorators/audit.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CreatePartnerApiKeyDto } from '../dto/create-partner-api-key.dto';
import { PartnerApiKeysService } from '../services/partner-api-keys.service';

@ApiTags('Admin · Partner API Keys')
@ApiBearerAuth()
@Controller('partner-api-keys')
export class PartnerApiKeysController {
  constructor(private readonly keys: PartnerApiKeysService) {}

  @Get()
  @Permissions(PERMISSIONS.APIKEY_READ)
  @ApiOperation({ summary: 'Danh sách API key đối tác' })
  list() {
    return this.keys.list();
  }

  @Post()
  @Permissions(PERMISSIONS.APIKEY_MANAGE)
  @Audit('apikey.create', 'apikey')
  @ApiOperation({ summary: 'Tạo API key (trả về khóa thô một lần duy nhất)' })
  create(@Body() dto: CreatePartnerApiKeyDto) {
    return this.keys.create(dto);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.APIKEY_MANAGE)
  @Audit('apikey.revoke', 'apikey')
  @ApiOperation({ summary: 'Thu hồi API key' })
  revoke(@Param('id', ParseUUIDPipe) id: string) {
    return this.keys.revoke(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PERMISSIONS.APIKEY_MANAGE)
  @Audit('apikey.delete', 'apikey')
  @ApiOperation({ summary: 'Xóa vĩnh viễn API key' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.keys.remove(id);
  }
}
