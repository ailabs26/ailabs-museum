import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { PermissionsController } from './controllers/permissions.controller';
import { PermissionsRepository } from './repositories/permissions.repository';
import { Role } from './entities/role.entity';
import { RolesController } from './controllers/roles.controller';
import { RolesRepository } from './repositories/roles.repository';
import { RolesService } from './services/roles.service';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission, RolePermission, UserRole])],
  controllers: [RolesController, PermissionsController],
  providers: [RolesService, RolesRepository, PermissionsRepository],
  exports: [RolesService],
})
export class RolesModule {}
