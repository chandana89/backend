import { Controller, Post, Body } from '@nestjs/common';
import { AuthenticateService } from './authenticate.service';

@Controller('authenticate')
export class AuthenicateController {
    constructor(private authService: AuthenticateService) { }

    /** Password sign-in. Returns `{ user }` (the email), the same shape as `POST /passkey/login/verify`. */
    @Post('login')
    async Login(@Body() body: { userName: string, password: string }) {
        const user = await this.authService.Login(body.userName, body.password);
        return { user: user.email }
    }

    @Post('logout')
    async Logout(@Body() body: { userName: string }) {
        await this.authService.Logout(body.userName);
        return { success: true }
    }
}