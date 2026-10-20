import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as webauthn from '@simplewebauthn/server';
import { User } from 'src/entities/user.entity';
import { PasskeyService } from './passkey.service';

jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn(),
  verifyRegistrationResponse: jest.fn(),
  generateAuthenticationOptions: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
}));

const mocked = webauthn as jest.Mocked<typeof webauthn>;

/** A WebAuthn response whose clientDataJSON carries `challenge`. */
function authRespFor(challenge: string, id = 'cred-1'): any {
  const clientDataJSON = Buffer.from(JSON.stringify({ challenge })).toString('base64url');
  return { id, rawId: id, type: 'public-key', response: { clientDataJSON }, clientExtensionResults: {} };
}

describe('PasskeyService', () => {
  const env = { ...process.env };
  let service: PasskeyService;
  let passkeyRepo: any;
  let userRepo: any;
  let sessionService: any;
  let queryBuilder: any;
  let user: User;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.RP_NAME = 'Test RP';
    process.env.RP_ID = 'localhost';
    process.env.ORIGIN = 'http://localhost:5173';

    queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };
    passkeyRepo = {
      find: jest.fn().mockResolvedValue([]),
      exists: jest.fn().mockResolvedValue(false),
      save: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(() => queryBuilder),
    };
    userRepo = { save: jest.fn() };
    sessionService = { create: jest.fn().mockResolvedValue('session-token') };

    user = Object.assign(new User(), {
      id: 'user-1',
      email: 'a@example.com',
      currentChallenge: null,
      currentChallengeExpiresAt: null,
      webauthnUserId: null,
    });

    service = new PasskeyService(passkeyRepo, userRepo, sessionService);
  });

  afterAll(() => { process.env = env; });

  describe('configuration', () => {
    it.each(['RP_NAME', 'RP_ID', 'ORIGIN'])('refuses to start without %s', name => {
      delete process.env[name];
      expect(() => new PasskeyService(passkeyRepo, userRepo, sessionService)).toThrow(name);
    });
  });

  describe('registration', () => {
    beforeEach(() => {
      mocked.generateRegistrationOptions.mockResolvedValue({ challenge: 'reg-challenge' } as any);
    });

    it('saves the challenge and a stable user handle', async () => {
      await service.getPasskeyRegistrationOptions(user);
      const handle = user.webauthnUserId;
      expect(handle).toBeTruthy();
      expect(user.currentChallenge).toBe('reg-challenge');
      expect(user.currentChallengeExpiresAt!.getTime()).toBeGreaterThan(Date.now());

      await service.getPasskeyRegistrationOptions(user);
      expect(user.webauthnUserId).toBe(handle);
      expect(mocked.generateRegistrationOptions).toHaveBeenLastCalledWith(
        expect.objectContaining({ userID: Buffer.from(handle!, 'base64url') }),
      );
    });

    it('stores the passkey and clears the challenge', async () => {
      await service.getPasskeyRegistrationOptions(user);
      mocked.verifyRegistrationResponse.mockResolvedValue({
        verified: true,
        registrationInfo: { credential: { id: 'cred-1', publicKey: new Uint8Array([1, 2]), counter: 0, transports: ['internal'] } },
      } as any);

      await expect(service.verifyPasskeyRegistration(user, {} as any)).resolves.toEqual({ verified: true });
      expect(passkeyRepo.save).toHaveBeenCalledWith(expect.objectContaining({ credentialID: 'cred-1', user }));
      expect(user.currentChallenge).toBeNull();
    });

    it('returns 400, not 500, when the library throws', async () => {
      await service.getPasskeyRegistrationOptions(user);
      mocked.verifyRegistrationResponse.mockRejectedValue(new Error('Unexpected origin'));

      await expect(service.verifyPasskeyRegistration(user, {} as any)).rejects.toThrow(BadRequestException);
      expect(user.currentChallenge).toBeNull();
    });

    it('rejects an expired challenge', async () => {
      user.currentChallenge = 'old';
      user.currentChallengeExpiresAt = new Date(Date.now() - 1);
      await expect(service.verifyPasskeyRegistration(user, {} as any)).rejects.toThrow('No registration in progress');
      expect(mocked.verifyRegistrationResponse).not.toHaveBeenCalled();
    });

    it('rejects a credential that is already registered', async () => {
      await service.getPasskeyRegistrationOptions(user);
      mocked.verifyRegistrationResponse.mockResolvedValue({
        verified: true,
        registrationInfo: { credential: { id: 'cred-1', publicKey: new Uint8Array([1]), counter: 0 } },
      } as any);
      passkeyRepo.exists.mockResolvedValue(true);

      await expect(service.verifyPasskeyRegistration(user, {} as any)).rejects.toThrow('already registered');
      expect(passkeyRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('sign-in', () => {
    const passkey = () => ({ id: 'pk-1', credentialID: 'cred-1', publicKey: Buffer.from([1]), counter: 0, user });

    beforeEach(() => {
      mocked.generateAuthenticationOptions.mockResolvedValue({ challenge: 'login-challenge' } as any);
    });

    it('signs in and starts a session', async () => {
      await service.getPasskeyLoginOptions();
      queryBuilder.getOne.mockResolvedValue(passkey());
      mocked.verifyAuthenticationResponse.mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 5 } } as any);

      await expect(service.verifyPasskeyLogin(authRespFor('login-challenge'))).resolves.toEqual({
        user: 'a@example.com',
        token: 'session-token',
      });
      expect(passkeyRepo.save).toHaveBeenCalledWith(expect.objectContaining({ counter: 5 }));
    });

    it('rejects a challenge it did not issue', async () => {
      await expect(service.verifyPasskeyLogin(authRespFor('made-up'))).rejects.toThrow('expired');
    });

    it('uses each challenge once', async () => {
      await service.getPasskeyLoginOptions();
      queryBuilder.getOne.mockResolvedValue(null);
      await expect(service.verifyPasskeyLogin(authRespFor('login-challenge'))).rejects.toThrow('not recognised');
      await expect(service.verifyPasskeyLogin(authRespFor('login-challenge'))).rejects.toThrow('expired');
    });

    it('hides library error messages', async () => {
      await service.getPasskeyLoginOptions();
      queryBuilder.getOne.mockResolvedValue(passkey());
      mocked.verifyAuthenticationResponse.mockRejectedValue(new Error('Unexpected authentication response origin'));

      const error = await service.verifyPasskeyLogin(authRespFor('login-challenge')).catch(e => e);
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.message).toBe('Passkey verification failed');
      expect(sessionService.create).not.toHaveBeenCalled();
    });

    it('caps pending challenges', async () => {
      let n = 0;
      mocked.generateAuthenticationOptions.mockImplementation(async () => ({ challenge: `c${n++}` }) as any);
      for (let i = 0; i < 10_000; i++) await service.getPasskeyLoginOptions();
      await expect(service.getPasskeyLoginOptions()).rejects.toThrow('Too many sign-in attempts');
    });
  });

  describe('management', () => {
    it('only deletes the user\'s own passkeys', async () => {
      passkeyRepo.delete.mockResolvedValue({ affected: 0 });
      await expect(service.deletePasskey(user, 'pk-other')).rejects.toThrow(NotFoundException);
      expect(passkeyRepo.delete).toHaveBeenCalledWith({ id: 'pk-other', user: { id: 'user-1' } });
    });

    it('lists passkeys without key material', async () => {
      const createdAt = new Date();
      passkeyRepo.find.mockResolvedValue([{ id: 'pk-1', createdAt, transports: ['internal'], publicKey: Buffer.from([1]), credentialID: 'c' }]);
      await expect(service.listPasskeys(user)).resolves.toEqual([{ id: 'pk-1', createdAt, transports: ['internal'] }]);
    });
  });
});
