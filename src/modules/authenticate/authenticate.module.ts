import { Module } from '@nestjs/common';
import { AuthenticateService } from './authenticate.service';
import { AuthenicateController } from './authenticate.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User]),],
  providers: [AuthenticateService],
  controllers: [AuthenicateController],
  exports: [AuthenticateService],
})
export class AuthenicateModule { }