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
 * `credential_id` is a bytea column, so a stored ID comes back as a Buffer holding
 * the base64url string's bytes. Convert it back to the string simplewebauthn expects.
 */
const toCredentialID = (id: string | Buffer): string =>
  Buffer.isBuffer(id) ? id.toString('utf8') : id;

@Injectable()
export class PasskeyService {

  private readonly rpName = process.env.RP_NAME || '';
  private readonly rpID = process.env.RP_ID || '';
  private readonly origin = process.env.ORIGIN || '';

  constructor(
    @InjectRepository(Passkey) private passkeyRepo: Repository<Passkey>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {

  }

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
        id: toCredentialID(passkey.credentialID),
        transports: passkey.transports,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    user.currentChallenge = options.challenge;
    await this.userRepo.save(user);

    return options;
  }

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

    user.currentChallenge = null;
    await user.save();

    return { verified: true };
  }

  async getPasskeyLoginOptions(userName: string) {
    const user = await this.userRepo.findOne({ where: { email: userName } });
    const passkeys = user
      ? await this.passkeyRepo.find({ where: { user: { id: user.id } } })
      : [];
    if (!user || passkeys.length === 0) {
      throw new BadRequestException('No passkey registered for this account');
    }

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials: passkeys.map(passkey => ({
        id: toCredentialID(passkey.credentialID),
        transports: passkey.transports,
      })),
      userVerification: 'preferred',
    });

    user.currentChallenge = options.challenge;
    await this.userRepo.save(user);

    return options;
  }

  async verifyPasskeyLogin(userName: string, authResp: any) {
    const user = await this.userRepo.findOne({ where: { email: userName } });
    if (!user || !user.currentChallenge) {
      throw new UnauthorizedException('No sign-in in progress');
    }

    const passkeys = await this.passkeyRepo.find({ where: { user: { id: user.id } } });
    const passkey = passkeys.find(p => toCredentialID(p.credentialID) === authResp?.id);
    if (!passkey) {
      throw new UnauthorizedException('Passkey not recognised for this account');
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: authResp,
        expectedChallenge: user.currentChallenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        credential: {
          id: toCredentialID(passkey.credentialID),
          publicKey: new Uint8Array(passkey.publicKey),
          counter: passkey.counter ?? 0,
          transports: passkey.transports,
        },
      });
    } catch (e: any) {
      throw new UnauthorizedException(e?.message || 'Passkey verification failed');
    } finally {
      // A challenge is single-use, whether or not verification succeeded.
      user.currentChallenge = null;
      await user.save();
    }

    if (!verification.verified) {
      throw new UnauthorizedException('Passkey verification failed');
    }

    passkey.counter = verification.authenticationInfo.newCounter;
    await passkey.save();

    return { user: user.email };
  }
}