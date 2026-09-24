import { Controller, Body, Get, Post } from '@nestjs/common';
import { PasskeyService } from './passkey.service';

/**
 * WebAuthn passkey endpoints. Each ceremony (registration, sign-in) takes two calls:
 * one to get options containing a fresh challenge, one to verify the browser's response.
 * Registration identifies the account by `userName` (the user's email); sign-in needs no
 * email, as the account is found from the passkey itself.
 */
@Controller('passkey')
export class PasskeyController {
    constructor(private passkeyService: PasskeyService) { }

    /** Step 1 of registration: returns options for `startRegistration` in the browser. */
    @Post()
    async GetPasskeyRegistrationOptions(@Body() body: { userName: string}) {
        return this.passkeyService.getPasskeyRegistrationOptions(body.userName);
    }

    /** Step 2 of registration: verifies the new credential and stores it as a passkey. */
    @Post('verify')
    async VerifyPasskeyRegistration(@Body() body: { userName:string, authResp: any}) {
        console.log(body.authResp,"authresp")
        return this.passkeyService.verifyPasskeyRegistration(body.userName, body.authResp);
    }

    /** Step 1 of sign-in: returns usernameless options for `startAuthentication` in the browser. */
    @Post('login')
    async GetPasskeyLoginOptions() {
        return this.passkeyService.getPasskeyLoginOptions();
    }

    /** Step 2 of sign-in: verifies the signed challenge and returns `{ user }` like password login. */
    @Post('login/verify')
    async VerifyPasskeyLogin(@Body() body: { authResp: any }) {
        return this.passkeyService.verifyPasskeyLogin(body.authResp);
    }

}
