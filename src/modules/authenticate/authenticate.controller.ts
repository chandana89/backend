import { Controller, Post, Body, UseGuards, Req, HttpCode } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthenticateService } from './authenticate.service';
import { AuthGuard } from './auth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('authenticate')
export class AuthenicateController {
    constructor(private authService: AuthenticateService) { }

    /**
     * Password sign-in. Returns `{ user, token }`, the same shape as `POST /passkey/login/verify`.
     * Send the token as `Authorization: Bearer <token>` to authenticated endpoints.
     */
    @Post('login')
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    async Login(@Body() body: LoginDto) {
        return this.authService.Login(body.userName, body.password);
    }

    /** Creates an account and signs it in. Returns `{ user, token }`, the same shape as `login`. */
    @Post('register')
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    async Register(@Body() body: RegisterDto) {
        return this.authService.Register(body.email, body.password);
    }

    /** Ends the current session. */
    @Post('logout')
    @HttpCode(200)
    @UseGuards(AuthGuard)
    async Logout(@Req() req: any) {
        await this.authService.Logout(req.user, req.sessionToken);
        return { success: true }
    }
}
