import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'root',
      password: 'root',
      database: 'portfolio',
      autoLoadEntities: true,
      synchronize: true, // For dev only!
    }),
    ConfigModule.forRoot({
      isGlobal: true, // makes env variables accessible globally
    }),
    DashboardModule,
  ],
})
export class AppModule {}
