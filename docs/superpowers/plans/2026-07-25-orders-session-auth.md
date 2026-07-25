# Session-based auth for `/orders` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add username/password login that issues a session token, and require that token on all `/orders` routes.

**Architecture:** New `authRoutes.ts` -> `authService.ts` -> `userRepo.ts` + `sessionRepo.ts`, following this codebase's existing `routes/ -> services/ -> repositories/` layering. Both new repositories are built from the existing `createAsyncStore` factory (gains a `delete` method). A new `requireAuth` middleware gates the `orderRouter` mount in `app.ts`; a new `AuthError` gets special-cased in `errorHandler` to return 401 instead of the default 400.

**Tech Stack:** Express, TypeScript, Jest + ts-jest, supertest (already a devDependency, unused until this feature), `bcryptjs` (new dependency, for password hashing).

**Full spec:** `docs/superpowers/specs/2026-07-25-orders-session-auth-design.md`

## Global Constraints

- Only `/orders` is gated by auth. `/products` and `/health` stay open. (spec: API scope)
- No token expiry/TTL. Sessions live until an explicit `POST /auth/logout`. (spec: out of scope)
- No `POST /auth/register`. Exactly one demo user, seeded in `createApp()`. (spec: seed data)
- No roles/permissions, no login rate-limiting. (spec: out of scope)
- `POST /auth/login` failure (unknown username OR wrong password) always throws the same `AuthError('invalid credentials')` — never reveal which one was wrong. (spec: API / login)
- `POST /auth/logout` is idempotent: always responds `204`, whether or not the token existed. (spec: API / logout)
- New repositories (`userRepo`, `sessionRepo`) must be built from the existing `createAsyncStore` factory, not ad-hoc `Map`s — preserves the tick-based async semantics every other repository in this codebase has. (spec: architecture)
- `errorHandler` keeps its existing "everything is 400" default; `AuthError` is the one instance that returns `401`. No other new status codes. (spec: error handling)

---

### Task 1: `createAsyncStore` gains `delete`; add `User`/`Session` types; create `userRepo`/`sessionRepo`

**Files:**
- Modify: `src/repositories/asyncStore.ts`
- Modify: `src/types.ts`
- Create: `src/repositories/userRepo.ts`
- Create: `src/repositories/sessionRepo.ts`
- Test: `src/__tests__/asyncStore.test.ts`

**Interfaces:**
- Consumes: nothing (foundational task)
- Produces:
  - `createAsyncStore<T>(key).delete(id: string): Promise<void>` — removes the entry if present, no-op (does not throw) if absent
  - `User { username: string; passwordHash: string }`
  - `Session { token: string; username: string }`
  - `userRepo: ReturnType<typeof createAsyncStore<User>>` keyed by `username`
  - `sessionRepo: ReturnType<typeof createAsyncStore<Session>>` keyed by `token`

- [ ] **Step 1: Write the failing test for `delete`**

Create `src/__tests__/asyncStore.test.ts`:

```ts
import { createAsyncStore } from '../repositories/asyncStore';

interface Item {
  id: string;
  value: number;
}

describe('createAsyncStore', () => {
  it('put then get returns the item', async () => {
    const store = createAsyncStore<Item>((i) => i.id);
    await store.put({ id: 'a', value: 1 });
    expect(await store.get('a')).toEqual({ id: 'a', value: 1 });
  });

  it('get on a missing id returns undefined', async () => {
    const store = createAsyncStore<Item>((i) => i.id);
    expect(await store.get('missing')).toBeUndefined();
  });

  it('delete removes the item', async () => {
    const store = createAsyncStore<Item>((i) => i.id);
    await store.put({ id: 'a', value: 1 });
    await store.delete('a');
    expect(await store.get('a')).toBeUndefined();
  });

  it('delete on a missing id does not throw', async () => {
    const store = createAsyncStore<Item>((i) => i.id);
    await expect(store.delete('missing')).resolves.toBeUndefined();
  });

  it('all returns every stored item', async () => {
    const store = createAsyncStore<Item>((i) => i.id);
    await store.put({ id: 'a', value: 1 });
    await store.put({ id: 'b', value: 2 });
    expect(await store.all()).toEqual([
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify `delete` fails**

Run: `npx jest src/__tests__/asyncStore.test.ts`
Expected: FAIL — `store.delete is not a function`

- [ ] **Step 3: Add `delete` to `createAsyncStore`**

In `src/repositories/asyncStore.ts`, add a `delete` method alongside `get`/`put`/`all`/`seed`:

```ts
export function createAsyncStore<T>(key: (item: T) => string) {
  const map = new Map<string, T>();
  return {
    async get(id: string): Promise<T | undefined> {
      await tick();
      return map.get(id);
    },
    async put(item: T): Promise<T> {
      await tick();
      map.set(key(item), item);
      return item;
    },
    async delete(id: string): Promise<void> {
      await tick();
      map.delete(id);
    },
    async all(): Promise<T[]> {
      await tick();
      return Array.from(map.values());
    },
    async seed(items: T[]): Promise<void> {
      map.clear();
      for (const item of items) map.set(key(item), item);
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/__tests__/asyncStore.test.ts`
Expected: PASS (all 5 tests)

- [ ] **Step 5: Add `User`/`Session` types**

In `src/types.ts`, append:

```ts
export interface User {
  username: string;
  passwordHash: string;
}

export interface Session {
  token: string;
  username: string;
}
```

- [ ] **Step 6: Create `userRepo` and `sessionRepo`**

Create `src/repositories/userRepo.ts`:

```ts
import { User } from '../types';
import { createAsyncStore } from './asyncStore';

export const userRepo = createAsyncStore<User>((u) => u.username);
```

Create `src/repositories/sessionRepo.ts`:

```ts
import { Session } from '../types';
import { createAsyncStore } from './asyncStore';

export const sessionRepo = createAsyncStore<Session>((s) => s.token);
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/repositories/asyncStore.ts src/types.ts src/repositories/userRepo.ts src/repositories/sessionRepo.ts src/__tests__/asyncStore.test.ts
git commit -m "feat: add delete to createAsyncStore, User/Session types, userRepo/sessionRepo"
```

---

### Task 2: `AuthError` + `errorHandler` returns 401 for it

**Files:**
- Create: `src/lib/errors.ts`
- Modify: `src/middleware/errorHandler.ts`
- Test: `src/__tests__/errorHandler.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `AuthError` (extends `Error`, no extra fields) from `src/lib/errors.ts`, imported by later tasks (`authService`, `requireAuth`, `authRoutes`) to signal a 401

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/errorHandler.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/__tests__/errorHandler.test.ts`
Expected: FAIL — cannot find module `../lib/errors`

- [ ] **Step 3: Create `AuthError`**

Create `src/lib/errors.ts`:

```ts
export class AuthError extends Error {}
```

- [ ] **Step 4: Update `errorHandler`**

Replace the contents of `src/middleware/errorHandler.ts`:

```ts
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest src/__tests__/errorHandler.test.ts`
Expected: PASS (all 3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/errors.ts src/middleware/errorHandler.ts src/__tests__/errorHandler.test.ts
git commit -m "feat: add AuthError, errorHandler returns 401 for it"
```

---

### Task 3: `authService` (login / verifyToken / logout)

**Files:**
- Modify: `package.json` (add `bcryptjs` + `@types/bcryptjs`)
- Create: `src/services/authService.ts`
- Test: `src/__tests__/authService.test.ts`

**Interfaces:**
- Consumes:
  - `userRepo.get(username): Promise<User | undefined>`, `sessionRepo.get(token)`, `sessionRepo.put(session)`, `sessionRepo.delete(token)` from Task 1
  - `AuthError` from Task 2
- Produces:
  - `login(username: string, password: string): Promise<string>` — returns a session token, throws `AuthError('invalid credentials')` on any failure
  - `logout(token: string): Promise<void>` — idempotent, never throws for a missing token
  - `verifyToken(token: string): Promise<string>` — returns the `username` for a valid token, throws `AuthError('unauthorized')` otherwise
  - All three consumed directly by `requireAuth` (Task 4) and `authRoutes` (Task 5)

- [ ] **Step 1: Add `bcryptjs`**

Run:
```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

- [ ] **Step 2: Write the failing tests**

Create `src/__tests__/authService.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest src/__tests__/authService.test.ts`
Expected: FAIL — cannot find module `../services/authService`

- [ ] **Step 4: Implement `authService`**

Create `src/services/authService.ts`:

```ts
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { userRepo } from '../repositories/userRepo';
import { sessionRepo } from '../repositories/sessionRepo';
import { AuthError } from '../lib/errors';

export async function login(username: string, password: string): Promise<string> {
  const user = await userRepo.get(username);
  if (!user) throw new AuthError('invalid credentials');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new AuthError('invalid credentials');

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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/__tests__/authService.test.ts`
Expected: PASS (all 7 tests)

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/services/authService.ts src/__tests__/authService.test.ts
git commit -m "feat: add authService (login/verifyToken/logout) with bcrypt password hashing"
```

---

### Task 4: `requireAuth` middleware

**Files:**
- Create: `src/middleware/requireAuth.ts`
- Test: `src/__tests__/requireAuth.test.ts`

**Interfaces:**
- Consumes: `verifyToken(token: string): Promise<string>` and `AuthError` from Task 3/2
- Produces:
  - `requireAuth(req, res, next)` Express middleware — reads `Authorization: Bearer <token>`, calls `next(new AuthError(...))` when missing/malformed/unknown, otherwise sets `req.username` and calls `next()`
  - Module augmentation adding `username?: string` to Express's `Request` type — later code (route handlers under `/orders`, if they ever need it) can read `req.username`
  - Consumed by `app.ts` in Task 5, mounted in front of `orderRouter`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/requireAuth.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/__tests__/requireAuth.test.ts`
Expected: FAIL — cannot find module `../middleware/requireAuth`

- [ ] **Step 3: Implement `requireAuth`**

Create `src/middleware/requireAuth.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/__tests__/requireAuth.test.ts`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/middleware/requireAuth.ts src/__tests__/requireAuth.test.ts
git commit -m "feat: add requireAuth middleware"
```

---

### Task 5: `authRoutes` + wire into `app.ts`

**Files:**
- Create: `src/routes/authRoutes.ts`
- Modify: `src/app.ts`
- Test: `src/__tests__/authRoutes.test.ts`

**Interfaces:**
- Consumes: `login`, `logout` from `authService` (Task 3); `requireAuth` from Task 4; existing `productRouter`, `orderRouter`, `errorHandler`, `productRepo`, `couponRepo` from `app.ts`; `userRepo` from Task 1
- Produces:
  - `authRouter` (Express `Router`) mounted at `/auth`: `POST /auth/login`, `POST /auth/logout`
  - `createApp()` now also seeds one demo user and gates `/orders` with `requireAuth`
  - This is the last task that touches production code — nothing downstream depends on its outputs beyond the final verification task

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/authRoutes.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/__tests__/authRoutes.test.ts`
Expected: FAIL — `/auth/login` returns 404 (route doesn't exist yet)

- [ ] **Step 3: Check `src/routes/productRoutes.ts` for the exact `Product` shape returned by `GET /products`**

This step is just a read, no code change — confirms the `GET /products` test assertion (`res.status === 200`) is the only thing this plan needs from that route; no changes to `productRoutes.ts` are made.

- [ ] **Step 4: Implement `authRoutes`**

Create `src/routes/authRoutes.ts`:

```ts
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
```

- [ ] **Step 5: Wire into `app.ts`**

Replace the contents of `src/app.ts`:

```ts
import express, { Express } from 'express';
import bcrypt from 'bcryptjs';
import { productRouter } from './routes/productRoutes';
import { orderRouter } from './routes/orderRoutes';
import { authRouter } from './routes/authRoutes';
import { errorHandler } from './middleware/errorHandler';
import { requireAuth } from './middleware/requireAuth';
import { productRepo } from './repositories/productRepo';
import { couponRepo } from './repositories/couponRepo';
import { userRepo } from './repositories/userRepo';

export async function createApp(): Promise<Express> {
  const app = express();
  app.use(express.json());

  await productRepo.seed([
    { sku: 'BOOK', name: 'Paperback', priceCents: 1500, stock: 25 },
    { sku: 'PEN', name: 'Gel Pen', priceCents: 250, stock: 100 },
    { sku: 'MUG', name: 'Coffee Mug', priceCents: 900, stock: 4 },
  ]);

  await couponRepo.seed([
    { code: 'SAVE10', type: 'percent', value: 10, minSubtotalCents: 2000, expiresAt: '2027-01-01T00:00:00.000Z' },
    { code: 'WELCOME200', type: 'fixed', value: 200, minSubtotalCents: 1000, expiresAt: '2027-01-01T00:00:00.000Z' },
    { code: 'EXPIRED', type: 'percent', value: 50, minSubtotalCents: 0, expiresAt: '2020-01-01T00:00:00.000Z' },
  ]);

  await userRepo.seed([{ username: 'admin', passwordHash: bcrypt.hashSync('password123', 10) }]);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/auth', authRouter);
  app.use('/products', productRouter);
  app.use('/orders', requireAuth, orderRouter);

  app.use(errorHandler);
  return app;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest src/__tests__/authRoutes.test.ts`
Expected: PASS (all 7 tests)

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/routes/authRoutes.ts src/app.ts src/__tests__/authRoutes.test.ts
git commit -m "feat: add auth HTTP routes, gate /orders with requireAuth"
```

---

### Task 6: Full verification

**Files:** none (verification only)

**Interfaces:**
- Consumes: the entire test suite and build pipeline
- Produces: confirmation that this feature is fully integrated with no regressions — nothing downstream depends on this task

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS, including every pre-existing test file (`inventory.test.ts`, `checkoutFeature.test.ts`, `orderService.test.ts`, `couponService.test.ts`, `pricing.test.ts`, `money.test.ts`) plus the four new files added in this plan. Note: the pre-existing tests call `checkout()` directly at the service layer rather than through HTTP, so `requireAuth` (an HTTP-layer middleware) does not affect them — no changes to those files are needed.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: compiles clean, `dist/` produced

- [ ] **Step 4: Manual smoke check (optional but recommended)**

Run: `npm run dev`, then in another shell:

```bash
curl -s -X POST http://localhost:3000/orders/checkout -H 'Content-Type: application/json' -d '{"lines":[{"sku":"BOOK","quantity":1}]}'
# expect: {"error":"unauthorized"} with 401

TOKEN=$(curl -s -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"password123"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")

curl -s -X POST http://localhost:3000/orders/checkout -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" -d '{"lines":[{"sku":"BOOK","quantity":1}]}'
# expect: 201 with the created order
```

- [ ] **Step 5: Commit (only if Step 4 revealed a fix)**

If the manual check passes with no changes needed, skip this step — Task 5's commit already covers the working feature.
