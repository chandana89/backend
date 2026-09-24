import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/entities/user.entity';
import { Repository } from 'typeorm';

/** Email and password sign-in. Passkey sign-in lives in `PasskeyService` and returns the same shape. */
@Injectable()
export class AuthenticateService {

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>
  ) { }


  /**
   * Finds the user matching `userName` (email) and `password`, or throws a 401.
   * The password is compared as stored, in plain text; there is no hashing yet.
   * No session or token is issued: the controller returns only the user's email.
   */
  public async Login(userName: string, password: string) {
    const user = await this.userRepo.findOne({ where: { email: userName, password } });
    if (!user) throw new UnauthorizedException('Invalid email or password');
    return user;
  }

  /**
   * Clears the user's saved push-notification token. Not exposed by the controller yet;
   * the frontend logs out by clearing its own session storage.
   */
  public async Logout(userName: string) {
    const user = await this.userRepo.findOne({ where: { email: userName } });
    if (!user) throw new Error(`Invalid user`);
    user.token = null;
    await user.save();
  }
}