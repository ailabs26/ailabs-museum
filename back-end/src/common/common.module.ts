import { Global, Module } from '@nestjs/common';
import { TransactionManager } from './database/transaction.manager';
import { PasswordService } from './security/password.service';

/**
 * Hạ tầng dùng chung (common), global để mọi module inject được mà không cần import lại.
 * Interceptor/Filter/Guard được đăng ký toàn cục ở main.ts & app.module.ts.
 */
@Global()
@Module({
  providers: [TransactionManager, PasswordService],
  exports: [TransactionManager, PasswordService],
})
export class CommonModule {}
