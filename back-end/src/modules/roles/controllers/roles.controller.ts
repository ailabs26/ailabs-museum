import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit } from '../../audit/decorators/audit.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { BulkIdsDto } from '../../../common/dto/bulk-ids.dto';
import { CreateRoleDto } from '../dto/create-role.dto';
import { SetPermissionsDto } from '../dto/set-permissions.dto';
import { SetPermissionMatrixDto } from '../dto/set-permission-matrix.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { RolesService } from '../services/roles.service';

@ApiTags('Admin · Roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @Permissions(PERMISSIONS.ROLE_READ)
  @ApiOperation({ summary: 'Danh sách vai trò kèm quyền' })
  list() {
    return this.roles.list();
  }

  @Post()
  @Permissions(PERMISSIONS.ROLE_CREATE)
  @Audit('role.create', 'role')
  @ApiOperation({ summary: 'Tạo vai trò' })
  create(@Body() dto: CreateRoleDto) {
    return this.roles.create(dto);
  }

  @Put('permission-matrix')
  @Permissions(PERMISSIONS.ROLE_UPDATE)
  @Audit('role.set_permission_matrix', 'role')
  @ApiOperation({ summary: 'Cập nhật nhiều vai trò trong ma trận quyền theo một transaction' })
  setPermissionMatrix(@Body() dto: SetPermissionMatrixDto) {
    return this.roles.setPermissionMatrix(dto);
  }

  @Get(':id/permissions')
  @Permissions(PERMISSIONS.ROLE_READ)
  @ApiOperation({ summary: 'Danh sách quyền của vai trò' })
  getPermissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.roles.getPermissions(id);
  }

  @Put(':id/permissions')
  @Permissions(PERMISSIONS.ROLE_UPDATE)
  @Audit('role.set_permissions', 'role')
  @ApiOperation({ summary: 'Đặt lại toàn bộ ma trận quyền của vai trò' })
  setPermissions(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetPermissionsDto) {
    return this.roles.setPermissions(id, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.ROLE_UPDATE)
  @Audit('role.update', 'role')
  @ApiOperation({ summary: 'Đổi tên vai trò' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) {
    return this.roles.update(id, dto);
  }

  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.ROLE_DELETE)
  @Audit('role.delete', 'role')
  @ApiOperation({ summary: 'Xóa mềm nhiều vai trò (tất cả hoặc không; chặn Admin / đang gán, 409 kèm lý do từng ID)' })
  removeMany(@Body() dto: BulkIdsDto) {
    return this.roles.removeMany(dto.ids);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.ROLE_DELETE)
  @Audit('role.delete', 'role')
  @ApiOperation({ summary: 'Xóa mềm vai trò (chặn Admin / đang gán cho người dùng)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.roles.remove(id);
  }
}
