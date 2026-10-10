import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../roles/role.entity';
import { UserRole } from '../user-roles/user-role.entity';
import { User } from './user.entity';
import { UserRolesRepository } from './repositories/user-roles.repository';
import { UsersRepository } from './repositories/users.repository';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserRole, Role])],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, UserRolesRepository],
  // UsersRepository được AuthModule tái sử dụng để đăng nhập / dựng token.
  exports: [UsersRepository, UsersService],
})
export class UsersModule {}
