import { hashPassword, isHashed, verifyPassword } from './password';

describe('password', () => {
  it('verifies a hashed password', async () => {
    const stored = await hashPassword('s3cret');
    expect(isHashed(stored)).toBe(true);
    expect(stored).not.toContain('s3cret');
    await expect(verifyPassword('s3cret', stored)).resolves.toBe(true);
    await expect(verifyPassword('wrong', stored)).resolves.toBe(false);
  });

  it('salts each hash', async () => {
    expect(await hashPassword('same')).not.toEqual(await hashPassword('same'));
  });

  it('accepts legacy plain-text passwords', async () => {
    expect(isHashed('plain')).toBe(false);
    await expect(verifyPassword('plain', 'plain')).resolves.toBe(true);
    await expect(verifyPassword('plain2', 'plain')).resolves.toBe(false);
  });

  it('rejects a malformed hash', async () => {
    await expect(verifyPassword('x', 'scrypt$')).resolves.toBe(false);
  });
});
