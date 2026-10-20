import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AuthenticationResponseJSON,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  RegistrationResponseJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { randomBytes } from 'crypto';
import { Passkey } from 'src/entities/passkey.entity';
import { User } from 'src/entities/user.entity';
import { Repository } from 'typeorm';
import { SessionService } from '../authenticate/session.service';

/**
 * Registers passkeys and signs users in with them, using @simplewebauthn/server.
 *
 * The relying party (RP) settings come from the environment, and the app refuses to start
 * without them:
 * - `RP_NAME`: display name shown in the browser's passkey prompt.
 * - `RP_ID`: domain passkeys are bound to (e.g. `localhost`); must match the frontend's host.
 * - `ORIGIN`: exact frontend origin, including scheme and port (e.g. `http://localhost:5173`).
 *
 * Registration challenges are stored on the user (`currentChallenge`). Sign-in is usernameless:
 * the user isn't known until the passkey is presented, so sign-in challenges are kept in
 * memory in `loginChallenges` instead.
 */
@Injectable()
export class PasskeyService {

  private readonly logger = new Logger(PasskeyService.name);

  private readonly rpName: string;
  private readonly rpID: string;
  private readonly origin: string;

  /** How long a registration or sign-in challenge stays valid. */
  private readonly challengeTTL = 5 * 60 * 1000;

  /** Most pending sign-in challenges kept at once, so the map can't grow without limit. */
  private readonly maxLoginChallenges = 10_000;

  /**
   * Pending sign-in challenges, mapped to their expiry time (ms since epoch). In memory, so
   * they are lost on restart and not shared between instances; move to a table or Redis
   * if the backend runs on more than one instance.
   */
  private readonly loginChallenges = new Map<string, number>();

  constructor(
    @InjectRepository(Passkey) private passkeyRepo: Repository<Passkey>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private sessionService: SessionService,
  ) {
    const missing = ['RP_NAME', 'RP_ID', 'ORIGIN'].filter(name => !process.env[name]?.trim());
    if (missing.length) {
      throw new Error(`Passkeys need ${missing.join(', ')} to be set in the environment`);
    }
    this.rpName = process.env.RP_NAME!.trim();
    this.rpID = process.env.RP_ID!.trim();
    this.origin = process.env.ORIGIN!.trim();
  }

  /** The signed-in user's passkeys, without key material. */
  async listPasskeys(user: User) {
    const passkeys = await this.passkeyRepo.find({
      where: { user: { id: user.id } },
      order: { createdAt: 'ASC' },
    });
    return passkeys.map(({ id, createdAt, transports }) => ({ id, createdAt, transports }));
  }

  /**
   * Builds registration options for the signed-in user and saves the challenge on them.
   *
   * Passkeys the user already has go in `excludeCredentials`, so the same authenticator
   * can't be registered twice. `authenticatorAttachment: 'platform'` limits registration to
   * the device's built-in authenticator (Touch ID, Windows Hello, Android screen lock).
   * `residentKey: 'required'` makes the passkey discoverable, which usernameless sign-in needs.
   */
  async getPasskeyRegistrationOptions(user: User) {
    const passkeys = await this.passkeyRepo.find({ where: { user: { id: user.id } } });

    if (!user.webauthnUserId) {
      user.webauthnUserId = randomBytes(32).toString('base64url');
    }

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userName: user.email,
      userID: Buffer.from(user.webauthnUserId, 'base64url'),
      attestationType: 'none',
      excludeCredentials: passkeys.map(passkey => ({
        id: passkey.credentialID,
        transports: passkey.transports,
      })),
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
        authenticatorAttachment: 'platform',
      },
    });

    user.currentChallenge = options.challenge;
    user.currentChallengeExpiresAt = new Date(Date.now() + this.challengeTTL);
    await this.userRepo.save(user);

    return options;
  }

  /**
   * Verifies the browser's registration response against the saved challenge, origin and
   * RP ID, then stores the new credential (ID, public key, counter, transports).
   */
  async verifyPasskeyRegistration(user: User, authResp: RegistrationResponseJSON) {
    const challenge = user.currentChallenge;
    const expiresAt = user.currentChallengeExpiresAt;
    if (!challenge || !expiresAt || expiresAt < new Date()) {
      throw new BadRequestException('No registration in progress');
    }

    // The challenge is single-use, whether or not verification succeeds.
    user.currentChallenge = null;
    user.currentChallengeExpiresAt = null;
    await this.userRepo.save(user);

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: authResp,
        expectedChallenge: challenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
      });
    } catch (e: any) {
      this.logger.warn(`Passkey registration failed for user ${user.id}: ${e?.message}`);
      throw new BadRequestException('Registration verification failed');
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Registration verification failed');
    }

    // The new credential: its ID, public key, starting counter and transports are all
    // needed to verify future sign-ins.
    const credential = verification.registrationInfo.credential;

    if (await this.passkeyRepo.exists({ where: { credentialID: credential.id } })) {
      throw new BadRequestException('This passkey is already registered');
    }

    const passkey = new Passkey();
    passkey.user = user;
    passkey.credentialID = credential.id;
    passkey.publicKey = Buffer.from(credential.publicKey);
    passkey.counter = credential.counter;
    // Browsers may omit transports; the column is nullable.
    passkey.transports = credential.transports!;

    await this.passkeyRepo.save(passkey);

    return { verified: true };
  }

  /** Deletes one of `user`'s passkeys. Another user's passkey is reported as not found. */
  async deletePasskey(user: User, id: string) {
    const result = await this.passkeyRepo.delete({ id, user: { id: user.id } });
    if (!result.affected) throw new NotFoundException('Passkey not found');
    return { deleted: true };
  }

  /**
   * Builds usernameless sign-in options. `allowCredentials` is left empty, so the browser
   * offers any discoverable passkey it has for this RP. The challenge is remembered in
   * `loginChallenges` until it is used or expires.
   */
  async getPasskeyLoginOptions() {
    this.pruneLoginChallenges();
    if (this.loginChallenges.size >= this.maxLoginChallenges) {
      throw new ServiceUnavailableException('Too many sign-in attempts, please try again shortly');
    }

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      userVerification: 'required',
    });

    this.loginChallenges.set(options.challenge, Date.now() + this.challengeTTL);

    return options;
  }

  /**
   * Verifies a usernameless sign-in response. The challenge is read from the response's
   * `clientDataJSON` and must be one this server issued and hasn't used. The passkey, and
   * with it the user, is looked up by the credential ID the browser returned; its signature
   * is then checked with the stored public key. Starts a session and returns `{ user, token }`,
   * matching password login.
   */
  async verifyPasskeyLogin(authResp: AuthenticationResponseJSON) {
    const challenge = this.readChallenge(authResp);
    const expiresAt = challenge ? this.loginChallenges.get(challenge) : undefined;
    if (!challenge || !expiresAt || expiresAt < Date.now()) {
      throw new UnauthorizedException('Sign-in request expired, please try again');
    }
    // A challenge is single-use, whether or not verification succeeds.
    this.loginChallenges.delete(challenge);

    // credential_id is bytea, so compare against the ID's bytes (see the entity's transformer).
    const passkey = typeof authResp?.id === 'string'
      ? await this.passkeyRepo
        .createQueryBuilder('passkey')
        .leftJoinAndSelect('passkey.user', 'user')
        .where('passkey.credential_id = :id', { id: Buffer.from(authResp.id, 'utf8') })
        .getOne()
      : null;
    if (!passkey || !passkey.user) {
      throw new UnauthorizedException('Passkey not recognised');
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: authResp,
        expectedChallenge: challenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        credential: {
          id: passkey.credentialID,
          publicKey: new Uint8Array(passkey.publicKey),
          counter: passkey.counter ?? 0,
          transports: passkey.transports,
        },
      });
    } catch (e: any) {
      this.logger.warn(`Passkey sign-in failed for passkey ${passkey.id}: ${e?.message}`);
      throw new UnauthorizedException('Passkey verification failed');
    }

    if (!verification.verified) {
      throw new UnauthorizedException('Passkey verification failed');
    }

    // simplewebauthn rejects a counter that goes backwards, which can indicate a cloned authenticator.
    passkey.counter = verification.authenticationInfo.newCounter;
    await this.passkeyRepo.save(passkey);

    const token = await this.sessionService.create(passkey.user);
    return { user: passkey.user.email, token };
  }

  /** Extracts the challenge the browser signed from a WebAuthn response's clientDataJSON. */
  private readChallenge(authResp: AuthenticationResponseJSON): string | undefined {
    try {
      const clientData = JSON.parse(
        Buffer.from(authResp.response.clientDataJSON, 'base64url').toString('utf8'),
      );
      return typeof clientData.challenge === 'string' ? clientData.challenge : undefined;
    } catch {
      return undefined;
    }
  }

  /** Drops expired sign-in challenges so abandoned sign-ins don't accumulate. */
  private pruneLoginChallenges() {
    const now = Date.now();
    for (const [challenge, expiresAt] of this.loginChallenges) {
      if (expiresAt < now) this.loginChallenges.delete(challenge);
    }
  }
}
