import { Module } from '@nestjs/common';
import { AuthenticateService } from './authenticate.service';
import { AuthenicateController } from './authenticate.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/entities/user.entity';
import { Session } from 'src/entities/session.entity';
import { SessionService } from './session.service';
import { AuthGuard } from './auth.guard';

@Module({
  imports: [TypeOrmModule.forFeature([User, Session]),],
  providers: [AuthenticateService, SessionService, AuthGuard],
  controllers: [AuthenicateController],
  exports: [AuthenticateService, SessionService, AuthGuard],
})
export class AuthenicateModule { }
