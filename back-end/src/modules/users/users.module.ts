import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../roles/entities/role.entity';
import { UserRole } from './entities/user-role.entity';
import { User } from './entities/user.entity';
import { UserRolesRepository } from './repositories/user-roles.repository';
import { UsersRepository } from './repositories/users.repository';
import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserRole, Role])],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, UserRolesRepository],
  // UsersRepository được AuthModule tái sử dụng để đăng nhập / dựng token.
  exports: [UsersRepository, UsersService],
})
export class UsersModule {}
