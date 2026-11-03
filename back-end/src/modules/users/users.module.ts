import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshSession } from '../auth/entities/refresh-session.entity';
import { RefreshSessionsRepository } from '../auth/repositories/refresh-sessions.repository';
import { Role } from '../roles/entities/role.entity';
import { UserRole } from './entities/user-role.entity';
import { User } from './entities/user.entity';
import { UserRolesRepository } from './repositories/user-roles.repository';
import { UsersRepository } from './repositories/users.repository';
import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserRole, Role, RefreshSession])],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, UserRolesRepository, RefreshSessionsRepository],
  // AuthModule tái sử dụng UsersRepository (đăng nhập) và RefreshSessionsRepository; đặt ở đây
  // để UsersService thu hồi phiên mà không tạo vòng phụ thuộc Users ↔ Auth.
  exports: [UsersRepository, UsersService, RefreshSessionsRepository],
})
export class UsersModule {}
