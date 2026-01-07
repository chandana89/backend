import { Module } from '@nestjs/common';
import { PasskeyService } from './passkey.service';
import { PasskeyController } from './passkey.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Passkey } from 'src/entities/passkey.entity';
import { User } from 'src/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Passkey, User]),],
  providers: [PasskeyService],
  controllers: [PasskeyController],
  exports: [PasskeyService],
})
export class PasskeyModule { }