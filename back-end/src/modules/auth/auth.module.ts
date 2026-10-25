import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RefreshSession } from './entities/refresh-session.entity';
import { UsersModule } from '../users/users.module';
import { AuthController } from './controllers/auth.controller';
import { RefreshCookieOriginGuard } from './guards/refresh-cookie-origin.guard';
import { AuthRateLimiter } from './services/auth-rate-limiter.service';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';

@Module({
  imports: [
    UsersModule, // tái sử dụng UsersRepository + RefreshSessionsRepository
    JwtModule.register({}), // secret/expiresIn truyền tường minh ở TokenService
    TypeOrmModule.forFeature([RefreshSession]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    AuthRateLimiter,
    RefreshCookieOriginGuard,
    // Guard toàn cục: JwtAuthGuard xác thực trước, PermissionsGuard kiểm quyền sau.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AuthModule {}
