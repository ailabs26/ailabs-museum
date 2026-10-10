import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { RolesService } from '../services/roles.service';

@ApiTags('Admin · Permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @Permissions(PERMISSIONS.PERMISSION_READ)
  @ApiOperation({ summary: 'Danh mục toàn bộ quyền hệ thống' })
  listAll() {
    return this.roles.listAllPermissions();
  }
}
