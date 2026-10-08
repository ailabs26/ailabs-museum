import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSource } from './config/data-source';
import { validateEnvironment } from './config/env';
import { CoreModule } from './core/core.module';
import { ExhibitsModule } from './exhibits/exhibits.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    TypeOrmModule.forRoot({ ...dataSource.options, autoLoadEntities: false }),
    CoreModule,
    ExhibitsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
