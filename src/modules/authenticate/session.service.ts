import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Session } from 'src/entities/session.entity';
import { User } from 'src/entities/user.entity';
import { LessThan, Repository } from 'typeorm';

/** Issues, resolves and revokes opaque bearer tokens for signed-in users. */
@Injectable()
export class SessionService {

  /** How long a session lasts after sign-in. */
  private readonly sessionTTL = 12 * 60 * 60 * 1000;

  constructor(
    @InjectRepository(Session) private sessionRepo: Repository<Session>,
  ) { }

  /** Starts a session for `user` and returns the raw token to hand to the client. */
  async create(user: User): Promise<string> {
    // Expired sessions are cleaned up here rather than by a scheduled job.
    await this.sessionRepo.delete({ expiresAt: LessThan(new Date()) });

    const token = randomBytes(32).toString('base64url');
    const session = this.sessionRepo.create({
      tokenHash: this.hash(token),
      expiresAt: new Date(Date.now() + this.sessionTTL),
      user,
    });
    await this.sessionRepo.save(session);
    return token;
  }

  /** Returns the user a token belongs to, or null if it is unknown or expired. */
  async resolve(token: string): Promise<User | null> {
    const session = await this.sessionRepo.findOne({
      where: { tokenHash: this.hash(token) },
      relations: { user: true },
    });
    if (!session || session.expiresAt < new Date()) return null;
    return session.user;
  }

  /** Ends the session for `token`. Unknown tokens are ignored. */
  async revoke(token: string) {
    await this.sessionRepo.delete({ tokenHash: this.hash(token) });
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
