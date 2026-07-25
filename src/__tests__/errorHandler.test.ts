import { Response } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import { AuthError } from '../lib/errors';

function mockRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('errorHandler', () => {
  it('responds 401 for an AuthError', () => {
    const res = mockRes();
    errorHandler(new AuthError('unauthorized'), {} as any, res, (() => undefined) as any);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'unauthorized' });
  });

  it('responds 400 for a plain Error (unchanged default)', () => {
    const res = mockRes();
    errorHandler(new Error('bad input'), {} as any, res, (() => undefined) as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'bad input' });
  });

  it('responds 400 for a non-Error thrown value', () => {
    const res = mockRes();
    errorHandler('oops', {} as any, res, (() => undefined) as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'internal server error' });
  });
});
