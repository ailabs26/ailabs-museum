import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RefreshSession } from './entities/refresh-session.entity';
import { UserRecoveryCode } from './entities/user-recovery-code.entity';
import { User } from '../users/entities/user.entity';
import { UserTwoFactorController } from './controllers/user-two-factor.controller';
import { TwoFactorRepository } from './repositories/two-factor.repository';
import { TwoFactorService } from './services/two-factor.service';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './controllers/auth.controller';
import { ActiveSessionGuard } from './guards/active-session.guard';
import { RefreshCookieOriginGuard } from './guards/refresh-cookie-origin.guard';
import { AuthRateLimiter } from './services/auth-rate-limiter.service';
import { AuthService } from './services/auth.service';
import { SessionsCleanupService } from './services/sessions-cleanup.service';
import { SessionsService } from './services/sessions.service';
import { TokenService } from './services/token.service';

@Module({
  imports: [
    UsersModule, // tái sử dụng UsersRepository + RefreshSessionsRepository
    AuditModule, // ghi audit đăng nhập/đăng xuất
    JwtModule.register({}), // secret/expiresIn truyền tường minh ở TokenService
    TypeOrmModule.forFeature([RefreshSession, User, UserRecoveryCode]),
  ],
  controllers: [AuthController, UserTwoFactorController],
  providers: [
    AuthService,
    SessionsService,
    SessionsCleanupService, // cron dọn refresh_sessions đã chết
    TokenService,
    TwoFactorService,
    TwoFactorRepository,
    AuthRateLimiter,
    RefreshCookieOriginGuard,
    // Guard toàn cục theo thứ tự: JwtAuthGuard xác thực → ActiveSessionGuard kiểm phiên còn sống
    // → PermissionsGuard kiểm quyền.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ActiveSessionGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AuthModule {}
