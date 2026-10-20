import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { SessionService } from './session.service';

/**
 * Requires an `Authorization: Bearer <token>` header from password or passkey login.
 * On success, the signed-in `User` is available as `req.user` and the raw token as
 * `req.sessionToken`.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private sessionService: SessionService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const [scheme, token] = (req.headers?.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Not signed in');

    const user = await this.sessionService.resolve(token);
    if (!user) throw new UnauthorizedException('Session expired, please sign in again');

    req.user = user;
    req.sessionToken = token;
    return true;
  }
}
