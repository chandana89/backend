import { Controller, Body, Delete, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthGuard } from '../authenticate/auth.guard';
import { VerifyLoginDto, VerifyRegistrationDto } from './dto/passkey.dto';
import { PasskeyService } from './passkey.service';

/**
 * WebAuthn passkey endpoints. Each ceremony (registration, sign-in) takes two calls:
 * one to get options containing a fresh challenge, one to verify the browser's response.
 * Registration and passkey management need a signed-in session (`Authorization: Bearer`);
 * sign-in needs no email, as the account is found from the passkey itself.
 */
@Controller('passkey')
@UseGuards(ThrottlerGuard)
export class PasskeyController {
    constructor(private passkeyService: PasskeyService) { }

    /** Lists the signed-in user's passkeys. */
    @Get()
    @UseGuards(AuthGuard)
    async ListPasskeys(@Req() req: any) {
        return this.passkeyService.listPasskeys(req.user);
    }

    /** Step 1 of registration: returns options for `startRegistration` in the browser. */
    @Post()
    @UseGuards(AuthGuard)
    async GetPasskeyRegistrationOptions(@Req() req: any) {
        return this.passkeyService.getPasskeyRegistrationOptions(req.user);
    }

    /** Step 2 of registration: verifies the new credential and stores it as a passkey. */
    @Post('verify')
    @UseGuards(AuthGuard)
    async VerifyPasskeyRegistration(@Req() req: any, @Body() body: VerifyRegistrationDto) {
        return this.passkeyService.verifyPasskeyRegistration(req.user, body.authResp);
    }

    /** Step 1 of sign-in: returns usernameless options for `startAuthentication` in the browser. */
    @Post('login')
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    async GetPasskeyLoginOptions() {
        return this.passkeyService.getPasskeyLoginOptions();
    }

    /** Step 2 of sign-in: verifies the signed challenge and returns `{ user, token }` like password login. */
    @Post('login/verify')
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    async VerifyPasskeyLogin(@Body() body: VerifyLoginDto) {
        return this.passkeyService.verifyPasskeyLogin(body.authResp);
    }

    /** Deletes one of the signed-in user's passkeys. */
    @Delete(':id')
    @UseGuards(AuthGuard)
    async DeletePasskey(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
        return this.passkeyService.deletePasskey(req.user, id);
    }

}
