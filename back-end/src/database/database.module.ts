import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSource } from '../config/data-source';

/**
 * Khởi tạo kết nối database cho toàn ứng dụng. Dùng chung danh sách entity và option
 * với data-source.ts (phục vụ cả CLI migration). synchronize luôn tắt.
 */
@Module({
  imports: [TypeOrmModule.forRoot({ ...dataSource.options, autoLoadEntities: false })],
})
export class DatabaseModule {}
