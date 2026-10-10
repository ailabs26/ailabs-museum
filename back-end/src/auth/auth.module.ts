import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../core/auth/permissions.guard';
import { RefreshSession } from '../refresh-sessions/refresh-session.entity';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshSessionsRepository } from './repositories/refresh-sessions.repository';
import { TokenService } from './token.service';

@Module({
  imports: [
    UsersModule, // tái sử dụng UsersRepository để đăng nhập
    JwtModule.register({}), // secret/expiresIn truyền tường minh ở TokenService
    TypeOrmModule.forFeature([RefreshSession]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    RefreshSessionsRepository,
    // Guard toàn cục: JwtAuthGuard xác thực trước, PermissionsGuard kiểm quyền sau.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AuthModule {}
