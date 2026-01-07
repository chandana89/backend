import { Controller, Body, Get, Post } from '@nestjs/common';
import { PasskeyService } from './passkey.service';

@Controller('passkey')
export class PasskeyController {
    constructor(private passkeyService: PasskeyService) { }

    @Post()
    async GetPasskeyRegistrationOptions(@Body() body: { userName: string}) {
        return this.passkeyService.getPasskeyRegistrationOptions(body.userName);
    }

    @Post('verify')
    async VerifyPasskeyRegistration(@Body() body: { userName:string, authResp: any}) {
        console.log(body.authResp,"authresp")
        return this.passkeyService.verifyPasskeyRegistration(body.userName, body.authResp);
    }

}