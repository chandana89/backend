import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { Passkey } from 'src/entities/passkey.entity';
import { User } from 'src/entities/user.entity';
import { Repository } from 'typeorm';

/**
 * Registers passkeys and signs users in with them, using @simplewebauthn/server.
 *
 * The relying party (RP) settings come from the environment:
 * - `RP_NAME`: display name shown in the browser's passkey prompt.
 * - `RP_ID`: domain passkeys are bound to (e.g. `localhost`); must match the frontend's host.
 * - `ORIGIN`: exact frontend origin, including scheme and port (e.g. `http://localhost:5173`).
 *
 * Registration challenges are stored in `user.currentChallenge`. Sign-in is usernameless:
 * the user isn't known until the passkey is presented, so sign-in challenges are kept in
 * memory in `loginChallenges` instead.
 */
@Injectable()
export class PasskeyService {

  private readonly rpName = process.env.RP_NAME || '';
  private readonly rpID = process.env.RP_ID || '';
  private readonly origin = process.env.ORIGIN || '';

  /** How long a sign-in challenge stays valid. */
  private readonly loginChallengeTTL = 5 * 60 * 1000;

  /**
   * Pending sign-in challenges, mapped to their expiry time (ms since epoch). In memory, so
   * they are lost on restart and not shared between instances; move to a table or Redis
   * if the backend runs on more than one instance.
   */
  private readonly loginChallenges = new Map<string, number>();

  constructor(
    @InjectRepository(Passkey) private passkeyRepo: Repository<Passkey>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {

  }

  /**
   * Builds registration options for `userName` and saves the challenge on the user.
   *
   * Passkeys the user already has go in `excludeCredentials`, so the same authenticator
   * can't be registered twice. `authenticatorAttachment: 'platform'` limits registration to
   * the device's built-in authenticator (Touch ID, Windows Hello, Android screen lock).
   * `residentKey: 'required'` makes the passkey discoverable, which usernameless sign-in needs.
   */
  async getPasskeyRegistrationOptions(userName: string) {
    const user = await this.userRepo.findOne({ where: { email: userName } });
    if (!user) throw new BadRequestException('Invalid user');

    const passkeys = await this.passkeyRepo.find({ where: { user: { id: user.id } } });

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userName: user.email,
      attestationType: 'none',
      excludeCredentials: passkeys.map(passkey => ({
        id: passkey.credentialID,
        transports: passkey.transports,
      })),
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    user.currentChallenge = options.challenge;
    await this.userRepo.save(user);

    return options;
  }

  /**
   * Verifies the browser's registration response against the saved challenge, origin and
   * RP ID, then stores the new credential (ID, public key, counter, transports).
   */
  async verifyPasskeyRegistration(userName: string, authResp: any) {
    const user = await this.userRepo.findOne({ where: { email: userName } });
    if (!user || !user.currentChallenge) {
      throw new BadRequestException('No registration in progress');
    }

    const verification = await verifyRegistrationResponse({
      response: authResp,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Registration verification failed');
    }

    const credential = verification.registrationInfo.credential;
    console.log(verification, "verification")

    const credentialID = credential.id;
    const credentialPublicKey = credential.publicKey;
    const counter = credential.counter;
    const transports = credential.transports;

    const passkey = new Passkey();
    passkey.user = user;
    passkey.credentialID = credentialID;
    passkey.publicKey = Buffer.from(credentialPublicKey);
    passkey.counter = counter;
    passkey.transports = transports!;

    await passkey.save();

    // The challenge has been used; clear it so the response can't be replayed.
    user.currentChallenge = null;
    await user.save();

    return { verified: true };
  }

  /**
   * Builds usernameless sign-in options. `allowCredentials` is left empty, so the browser
   * offers any discoverable passkey it has for this RP. The challenge is remembered in
   * `loginChallenges` until it is used or expires.
   */
  async getPasskeyLoginOptions() {
    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      userVerification: 'preferred',
    });

    this.pruneLoginChallenges();
    this.loginChallenges.set(options.challenge, Date.now() + this.loginChallengeTTL);

    return options;
  }

  /**
   * Verifies a usernameless sign-in response. The challenge is read from the response's
   * `clientDataJSON` and must be one this server issued and hasn't used. The passkey, and
   * with it the user, is looked up by the credential ID the browser returned; its signature
   * is then checked with the stored public key. Returns `{ user }`, matching password login.
   */
  async verifyPasskeyLogin(authResp: any) {
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
      throw new UnauthorizedException(e?.message || 'Passkey verification failed');
    }

    if (!verification.verified) {
      throw new UnauthorizedException('Passkey verification failed');
    }

    // simplewebauthn rejects a counter that goes backwards, which can indicate a cloned authenticator.
    passkey.counter = verification.authenticationInfo.newCounter;
    await passkey.save();

    return { user: passkey.user.email };
  }

  /** Extracts the challenge the browser signed from a WebAuthn response's clientDataJSON. */
  private readChallenge(authResp: any): string | undefined {
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
