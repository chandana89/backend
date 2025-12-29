import { Controller, Post, Body } from '@nestjs/common';
import { AuthenticateService } from './authenticate.service';

@Controller('authenticate')
export class AuthenicateController {
    constructor(private authService: AuthenticateService) { }

    @Post('login')
    async Login(@Body() body: { userName: string, password: string }) {
        const user = await this.authService.Login(body.userName, body.password);
        return { user: user.email }
    }
}