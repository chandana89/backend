import { Module } from '@nestjs/common';
import { PasskeyService } from './passkey.service';
import { PasskeyController } from './passkey.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Passkey } from 'src/entities/passkey.entity';
import { User } from 'src/entities/user.entity';

/**
 * Passkey (WebAuthn) registration and usernameless sign-in, served under `/passkey`.
 * Needs the `Passkey` repository for stored credentials and `User` for account lookup
 * and the pending registration challenge.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Passkey, User]),],
  providers: [PasskeyService],
  controllers: [PasskeyController],
  exports: [PasskeyService],
})
export class PasskeyModule { }