import { Module } from '@nestjs/common';
import { PasskeyService } from './passkey.service';
import { PasskeyController } from './passkey.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Passkey } from 'src/entities/passkey.entity';
import { User } from 'src/entities/user.entity';
import { AuthenicateModule } from '../authenticate/authenticate.module';

/**
 * Passkey (WebAuthn) registration, management and usernameless sign-in, served under `/passkey`.
 * Needs the `Passkey` repository for stored credentials, `User` for the pending registration
 * challenge, and `AuthenicateModule` for sessions and the auth guard.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Passkey, User]), AuthenicateModule],
  providers: [PasskeyService],
  controllers: [PasskeyController],
  exports: [PasskeyService],
})
export class PasskeyModule { }
