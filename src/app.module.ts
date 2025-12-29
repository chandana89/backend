import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ConfigModule } from '@nestjs/config';
import { ChatGPTModule } from './modules/chatgpt/chatgpt.module';
import { ChatGateway } from './chat/chat.gateway';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuthenicateModule } from './modules/authenticate/authenticate.module';

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
    ChatGPTModule,
    NotificationsModule,
    AuthenicateModule,
  ],
  providers: [ChatGateway],
})
export class AppModule { }
