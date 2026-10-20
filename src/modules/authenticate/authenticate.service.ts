import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/entities/user.entity';
import { QueryFailedError, Repository } from 'typeorm';
import { hashPassword, isHashed, verifyPassword } from './password';
import { SessionService } from './session.service';

/** Email and password sign-in. Passkey sign-in lives in `PasskeyService` and returns the same shape. */
@Injectable()
export class AuthenticateService {

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private sessionService: SessionService,
  ) { }


  /**
   * Checks `userName` (email) and `password`, starts a session and returns
   * `{ user, token }`, or throws a 401.
   * Passwords still stored in plain text are accepted once and replaced with a scrypt hash.
   */
  public async Login(userName: string, password: string) {
    const user = await this.userRepo.findOne({ where: { email: userName.trim().toLowerCase() } });
    if (!user || !(await verifyPassword(password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!isHashed(user.password)) {
      user.password = await hashPassword(password);
      await user.save();
    }

    const token = await this.sessionService.create(user);
    return { user: user.email, token };
  }

  /**
   * Creates an account for `email` with a scrypt-hashed `password`, starts a session and
   * returns `{ user, token }`, the same shape as `Login`. Throws a 409 if the email is taken.
   */
  public async Register(email: string, password: string) {
    const normalised = email.trim().toLowerCase();
    if (await this.userRepo.exists({ where: { email: normalised } })) {
      throw new ConflictException('An account with this email already exists');
    }

    const user = this.userRepo.create({ email: normalised, password: await hashPassword(password) });
    try {
      await this.userRepo.save(user);
    } catch (e) {
      // Two sign-ups for the same email at once: the unique constraint catches the second.
      if (e instanceof QueryFailedError && (e as any).driverError?.code === '23505') {
        throw new ConflictException('An account with this email already exists');
      }
      throw e;
    }

    const token = await this.sessionService.create(user);
    return { user: user.email, token };
  }

  /** Ends the session for `token` and clears the user's saved push-notification token. */
  public async Logout(user: User, token: string) {
    await this.sessionService.revoke(token);
    user.token = null;
    await this.userRepo.save(user);
  }
}
