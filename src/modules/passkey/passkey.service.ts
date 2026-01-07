import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import { Passkey } from 'src/entities/passkey.entity';
import { User } from 'src/entities/user.entity';
import { Repository } from 'typeorm';


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
    if (!user) throw new Error('Invalid user');

    const passkeys = await this.passkeyRepo.find({ where: { user } });

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
      throw new Error('No registration in progress');
    }

    const verification = await verifyRegistrationResponse({
      response: authResp,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
    });

    if (!verification.verified) {
      throw new Error('Registration verification failed');
    }

    const credential = verification.registrationInfo.credential;
    if (!credential) {
      throw new Error('No credential info returned');
    }
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

    // user.currentChallenge = null;
    await user.save();

    return { verified: true };
  }
}