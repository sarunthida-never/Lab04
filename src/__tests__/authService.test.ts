import bcrypt from 'bcryptjs';
import { login, logout, verifyToken } from '../services/authService';
import { userRepo } from '../repositories/userRepo';
import { sessionRepo } from '../repositories/sessionRepo';
import { AuthError } from '../lib/errors';

beforeEach(async () => {
  await userRepo.seed([{ username: 'admin', passwordHash: bcrypt.hashSync('password123', 10) }]);
  await sessionRepo.seed([]);
});

describe('authService', () => {
  it('login with correct credentials returns a token that verifies to the username', async () => {
    const token = await login('admin', 'password123');
    expect(typeof token).toBe('string');
    expect(await verifyToken(token)).toBe('admin');
  });

  it('login with the wrong password throws AuthError', async () => {
    await expect(login('admin', 'wrong')).rejects.toThrow(AuthError);
  });

  it('login with an unknown username throws AuthError', async () => {
    await expect(login('nope', 'password123')).rejects.toThrow(AuthError);
  });

  it('wrong password and unknown username produce the identical error message', async () => {
    await expect(login('admin', 'wrong')).rejects.toThrow('invalid credentials');
    await expect(login('nope', 'password123')).rejects.toThrow('invalid credentials');
  });

  it('verifyToken on an unknown token throws AuthError', async () => {
    await expect(verifyToken('never-issued')).rejects.toThrow(AuthError);
  });

  it('logout removes the session so verifyToken then fails', async () => {
    const token = await login('admin', 'password123');
    await logout(token);
    await expect(verifyToken(token)).rejects.toThrow(AuthError);
  });

  it('logout on an unknown token does not throw (idempotent)', async () => {
    await expect(logout('never-issued')).resolves.toBeUndefined();
  });
});
