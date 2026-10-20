import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ChatGPTModule } from './modules/chatgpt/chatgpt.module';
import { ChatGateway } from './chat/chat.gateway';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuthenicateModule } from './modules/authenticate/authenticate.module';
import { PasskeyModule } from './modules/passkey/passkey.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'root',
      password: 'root',
      database: 'sample',
      autoLoadEntities: true,
      synchronize: true, // For dev only!
    }),
    ConfigModule.forRoot({
      isGlobal: true, // makes env variables accessible globally
    }),
    // Limits are applied per route with ThrottlerGuard (sign-in endpoints only).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
    DashboardModule,
    ChatGPTModule,
    NotificationsModule,
    AuthenicateModule,
    PasskeyModule
  ],
  providers: [ChatGateway],
})
export class AppModule { }
