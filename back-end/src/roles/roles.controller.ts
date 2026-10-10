import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../common/constants/permissions.constant';
import { Permissions } from '../core/auth/permissions.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { SetPermissionsDto } from './dto/set-permissions.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

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
  @ApiOperation({ summary: 'Tạo vai trò' })
  create(@Body() dto: CreateRoleDto) {
    return this.roles.create(dto);
  }

  @Get(':id/permissions')
  @Permissions(PERMISSIONS.ROLE_READ)
  @ApiOperation({ summary: 'Danh sách quyền của vai trò' })
  getPermissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.roles.getPermissions(id);
  }

  @Put(':id/permissions')
  @Permissions(PERMISSIONS.ROLE_UPDATE)
  @ApiOperation({ summary: 'Đặt lại toàn bộ ma trận quyền của vai trò' })
  setPermissions(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetPermissionsDto) {
    return this.roles.setPermissions(id, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.ROLE_UPDATE)
  @ApiOperation({ summary: 'Đổi tên vai trò' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) {
    return this.roles.update(id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.ROLE_DELETE)
  @ApiOperation({ summary: 'Xóa vai trò (chặn vai trò hệ thống / đang dùng)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.roles.remove(id);
  }
}
