import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { appConfig, databaseConfig, jwtConfig, mediaConfig, validateEnvironment } from './config';
import { DatabaseModule } from './database/database.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContentReportsModule } from './modules/content-reports/content-reports.module';
import { ExhibitsModule } from './modules/exhibits/exhibits.module';
import { HealthModule } from './modules/health/health.module';
import { MediaModule } from './modules/media/media.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { PartnerApiKeysModule } from './modules/partner-api-keys/partner-api-keys.module';
import { RolesModule } from './modules/roles/roles.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { StatsModule } from './modules/stats/stats.module';
import { TranslationsModule } from './modules/translations/translations.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, mediaConfig],
      validate: validateEnvironment,
    }),
    DatabaseModule,
    CommonModule,
    // Phân hệ quản trị hệ thống (auth + RBAC + nhật ký).
    AuthModule,
    UsersModule,
    RolesModule,
    AuditModule,
    // Phân hệ nội dung (rooms, exhibits, media).
    RoomsModule,
    ExhibitsModule,
    MediaModule,
    // Kiểm duyệt nội dung (duyệt/từ chối/ẩn revision + diff).
    ModerationModule,
    // Báo cáo vi phạm (Client gửi + Admin xử lý).
    ContentReportsModule,
    // Số liệu tổng quan cho Dashboard Admin.
    StatsModule,
    // Bản dịch đa ngôn ngữ (CMS i18n).
    TranslationsModule,
    // API key cấp cho đối tác tích hợp.
    PartnerApiKeysModule,
    // Liveness + readiness (kiểm tra DB).
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
