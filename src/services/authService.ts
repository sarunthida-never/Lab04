import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { userRepo } from '../repositories/userRepo';
import { sessionRepo } from '../repositories/sessionRepo';
import { AuthError } from '../lib/errors';

export const BCRYPT_COST = 10;

const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing-safety', BCRYPT_COST);

export async function login(username: string, password: string): Promise<string> {
  if (typeof username !== 'string' || typeof password !== 'string') {
    throw new AuthError('invalid credentials');
  }

  const user = await userRepo.get(username);
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new AuthError('invalid credentials');

  const token = randomUUID();
  await sessionRepo.put({ token, username });
  return token;
}

export async function logout(token: string): Promise<void> {
  await sessionRepo.delete(token);
}

export async function verifyToken(token: string): Promise<string> {
  const session = await sessionRepo.get(token);
  if (!session) throw new AuthError('unauthorized');
  return session.username;
}
