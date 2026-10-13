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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit } from '../../audit/decorators/audit.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/types/auth-user.type';
import { AssignRolesDto } from '../dto/assign-roles.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { ListUsersQueryDto } from '../dto/list-users-query.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { SetUserRolesDto } from '../dto/set-user-roles.dto';
import { UsersService } from '../services/users.service';

@ApiTags('Admin · Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Permissions(PERMISSIONS.USER_READ)
  @ApiOperation({ summary: 'Danh sách người dùng (phân trang, lọc)' })
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.USER_READ)
  @ApiOperation({ summary: 'Chi tiết người dùng' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.getById(id);
  }

  @Post()
  @Permissions(PERMISSIONS.USER_CREATE)
  @Audit('user.create', 'user')
  @ApiOperation({ summary: 'Tạo người dùng mới' })
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser) {
    return this.users.create(dto, actor);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.USER_UPDATE)
  @Audit('user.update', 'user')
  @ApiOperation({ summary: 'Cập nhật người dùng' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.update(id, dto, actor);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.USER_DELETE)
  @Audit('user.delete', 'user')
  @ApiOperation({ summary: 'Xóa mềm người dùng (khóa dùng PATCH status)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.remove(id);
  }

  @Post(':id/roles')
  @Permissions(PERMISSIONS.ROLE_ASSIGN)
  @Audit('user.assign_roles', 'user')
  @ApiOperation({ summary: 'Gán vai trò cho người dùng' })
  assignRoles(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignRolesDto) {
    return this.users.assignRoles(id, dto.roleIds);
  }

  @Put(':id/roles')
  @Permissions(PERMISSIONS.ROLE_ASSIGN)
  @Audit('user.set_roles', 'user')
  @ApiOperation({ summary: 'Thay toàn bộ vai trò; [] để bỏ hết (bảo vệ Admin cuối cùng)' })
  setRoles(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetUserRolesDto) {
    return this.users.setRoles(id, dto.roleIds);
  }

  @Delete(':id/roles/:roleId')
  @Permissions(PERMISSIONS.ROLE_ASSIGN)
  @Audit('user.remove_role', 'user')
  @ApiOperation({ summary: 'Bỏ một vai trò khỏi người dùng' })
  removeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    return this.users.removeRole(id, roleId);
  }
}
