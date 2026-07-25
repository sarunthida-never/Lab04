import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../app';

describe('auth HTTP routes', () => {
  let app: Express;

  beforeEach(async () => {
    app = await createApp();
  });

  it('POST /auth/login with correct credentials returns 200 and a token', async () => {
    const res = await request(app).post('/auth/login').send({ username: 'admin', password: 'password123' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });

  it('POST /auth/login with the wrong password returns 401', async () => {
    const res = await request(app).post('/auth/login').send({ username: 'admin', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid credentials' });
  });

  it('POST /auth/login with an empty body returns 401', async () => {
    const res = await request(app).post('/auth/login').send({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid credentials' });
  });

  it('POST /auth/login with a missing password returns 401', async () => {
    const res = await request(app).post('/auth/login').send({ username: 'admin' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid credentials' });
  });

  it('POST /auth/login with a null password returns 401', async () => {
    const res = await request(app).post('/auth/login').send({ username: 'admin', password: null });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid credentials' });
  });

  it('POST /orders/checkout without a token returns 401', async () => {
    const res = await request(app)
      .post('/orders/checkout')
      .send({ lines: [{ sku: 'BOOK', quantity: 1 }] });
    expect(res.status).toBe(401);
  });

  it('POST /orders/checkout with a valid token reaches the real handler', async () => {
    const login = await request(app).post('/auth/login').send({ username: 'admin', password: 'password123' });
    const res = await request(app)
      .post('/orders/checkout')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ lines: [{ sku: 'BOOK', quantity: 1 }] });
    expect(res.status).toBe(201);
  });

  it('GET /products still works without a token (only /orders is gated)', async () => {
    const res = await request(app).get('/products');
    expect(res.status).toBe(200);
  });

  it('POST /auth/logout invalidates the token', async () => {
    const login = await request(app).post('/auth/login').send({ username: 'admin', password: 'password123' });
    const token = login.body.token;

    const logoutRes = await request(app).post('/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(logoutRes.status).toBe(204);

    const res = await request(app)
      .post('/orders/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ lines: [{ sku: 'BOOK', quantity: 1 }] });
    expect(res.status).toBe(401);
  });

  it('POST /auth/logout with no token is still 204 (idempotent)', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(204);
  });
});
