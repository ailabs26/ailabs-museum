import { Global, Module } from '@nestjs/common';
import { TransactionManager } from './database/transaction.manager';

/**
 * Hạ tầng dùng chung, global để mọi module inject được mà không cần import lại.
 * Interceptor/Filter/Guard được đăng ký toàn cục ở main.ts & app.module.ts.
 */
@Global()
@Module({
  providers: [TransactionManager],
  exports: [TransactionManager],
})
export class CoreModule {}
