import { IsObject } from 'class-validator';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';

/** Body of `POST /passkey/verify`: the value `startRegistration` resolved with. */
export class VerifyRegistrationDto {
  @IsObject()
  authResp: RegistrationResponseJSON;
}

/** Body of `POST /passkey/login/verify`: the value `startAuthentication` resolved with. */
export class VerifyLoginDto {
  @IsObject()
  authResp: AuthenticationResponseJSON;
}
