import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { dataSource } from './config/data-source';
import { validateEnvironment } from './config/env';
import { CoreModule } from './core/core.module';
import { ExhibitsModule } from './exhibits/exhibits.module';
import { HealthController } from './health.controller';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    TypeOrmModule.forRoot({ ...dataSource.options, autoLoadEntities: false }),
    CoreModule,
    // Phân hệ quản trị hệ thống (auth + RBAC + nhật ký).
    AuthModule,
    UsersModule,
    RolesModule,
    AuditModule,
    // Nội dung công khai.
    ExhibitsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
