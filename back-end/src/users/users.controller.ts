import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit } from '../audit/audit.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constant';
import { Permissions } from '../core/auth/permissions.decorator';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

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
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.USER_UPDATE)
  @Audit('user.update', 'user')
  @ApiOperation({ summary: 'Cập nhật người dùng' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.USER_DELETE)
  @Audit('user.delete', 'user')
  @ApiOperation({ summary: 'Khóa/xóa mềm người dùng' })
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
