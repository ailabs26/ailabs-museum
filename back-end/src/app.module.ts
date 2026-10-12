import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { appConfig, databaseConfig, jwtConfig, validateEnvironment } from './config';
import { DatabaseModule } from './database/database.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { ExhibitsModule } from './modules/exhibits/exhibits.module';
import { HealthController } from './modules/health/health.controller';
import { ModerationModule } from './modules/moderation/moderation.module';
import { RolesModule } from './modules/roles/roles.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { StatsModule } from './modules/stats/stats.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig],
      validate: validateEnvironment,
    }),
    DatabaseModule,
    CommonModule,
    // Phân hệ quản trị hệ thống (auth + RBAC + nhật ký).
    AuthModule,
    UsersModule,
    RolesModule,
    AuditModule,
    // Phân hệ nội dung (rooms, exhibits).
    RoomsModule,
    ExhibitsModule,
    // Kiểm duyệt nội dung (duyệt/từ chối/ẩn revision + diff).
    ModerationModule,
    // Số liệu tổng quan cho Dashboard Admin.
    StatsModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
