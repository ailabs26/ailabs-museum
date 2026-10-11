import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditController } from './controllers/audit.controller';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { AuditRepository } from './repositories/audit.repository';
import { AuditService } from './services/audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditRepository,
    // Ghi vết tự động cho mọi route có @Audit(...). Chỉ hoạt động khi có metadata,
    // nên đăng ký global là an toàn.
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}
