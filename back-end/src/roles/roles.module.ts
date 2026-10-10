import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from '../permissions/permission.entity';
import { RolePermission } from '../role-permissions/role-permission.entity';
import { UserRole } from '../user-roles/user-role.entity';
import { PermissionsController } from './permissions.controller';
import { PermissionsRepository } from './repositories/permissions.repository';
import { Role } from './role.entity';
import { RolesController } from './roles.controller';
import { RolesRepository } from './repositories/roles.repository';
import { RolesService } from './roles.service';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission, RolePermission, UserRole])],
  controllers: [RolesController, PermissionsController],
  providers: [RolesService, RolesRepository, PermissionsRepository],
  exports: [RolesService],
})
export class RolesModule {}
