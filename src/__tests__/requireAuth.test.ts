import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../middleware/requireAuth';
import { login } from '../services/authService';
import { userRepo } from '../repositories/userRepo';
import { sessionRepo } from '../repositories/sessionRepo';
import { AuthError } from '../lib/errors';

function mockReq(authHeader?: string): Request {
  return { header: (name: string) => (name === 'Authorization' ? authHeader : undefined) } as unknown as Request;
}

beforeEach(async () => {
  await userRepo.seed([{ username: 'admin', passwordHash: bcrypt.hashSync('password123', 10) }]);
  await sessionRepo.seed([]);
});

describe('requireAuth', () => {
  it('calls next() and sets req.username when the token is valid', async () => {
    const token = await login('admin', 'password123');
    const req = mockReq(`Bearer ${token}`);
    const next = jest.fn();
    await requireAuth(req, {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith();
    expect(req.username).toBe('admin');
  });

  it('calls next(AuthError) when the Authorization header is missing', async () => {
    const req = mockReq(undefined);
    const next = jest.fn();
    await requireAuth(req, {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.any(AuthError));
  });

  it('calls next(AuthError) when the token is unknown', async () => {
    const req = mockReq('Bearer not-a-real-token');
    const next = jest.fn();
    await requireAuth(req, {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.any(AuthError));
  });

  it('calls next(AuthError) when the header is not a Bearer token', async () => {
    const req = mockReq('Basic somevalue');
    const next = jest.fn();
    await requireAuth(req, {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.any(AuthError));
  });
});
