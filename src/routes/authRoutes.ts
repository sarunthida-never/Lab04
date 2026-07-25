import { Router, Request, Response, NextFunction } from 'express';
import { login, logout } from '../services/authService';

export const authRouter = Router();

authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body ?? {};
    const token = await login(username, password);
    res.status(200).json({ token });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = req.header('Authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (token) await logout(token);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
