import { Request, Response, NextFunction } from 'express';
import { AuthError } from '../lib/errors';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const message = err instanceof Error ? err.message : 'internal server error';
  if (err instanceof AuthError) {
    res.status(401).json({ error: message });
    return;
  }
  res.status(400).json({ error: message });
}
