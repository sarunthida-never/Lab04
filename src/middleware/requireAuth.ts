import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService';
import { AuthError } from '../lib/errors';

declare global {
  namespace Express {
    interface Request {
      username?: string;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  if (!token) {
    next(new AuthError('unauthorized'));
    return;
  }
  try {
    req.username = await verifyToken(token);
    next();
  } catch (err) {
    next(err);
  }
}
