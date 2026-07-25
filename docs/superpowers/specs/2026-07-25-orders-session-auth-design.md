# Session-based auth for `/orders`

## Purpose

`/orders/checkout` is currently open to anyone. Add username/password login that
issues a session token, and require that token on all `/orders` routes. Scope is
intentionally narrow: this protects `/orders` only, not `/products` or `/health`.

## Out of scope

- Token expiry / TTL (sessions live until explicit logout)
- Protecting `/products`
- User registration (`POST /auth/register`)
- Roles / permissions
- Rate-limiting login attempts

These were explicitly deferred during design to keep the feature focused (YAGNI).
If any becomes needed later, it's a separate spec.

## Architecture

Follows the existing `routes/ → services/ → repositories/` layering used
throughout this codebase (see root `CLAUDE.md`), and reuses the existing
`createAsyncStore<T>` factory for the two new repositories so auth data behaves
like every other piece of state in this app (tick-based async reads/writes).

```
routes/authRoutes.ts        (POST /auth/login, POST /auth/logout)
        |
        v
services/authService.ts     (login, logout, verifyToken)
        |
        v
repositories/userRepo.ts     repositories/sessionRepo.ts
(createAsyncStore<User>)     (createAsyncStore<Session>)

middleware/requireAuth.ts   -- gates orderRouter in app.ts
lib/errors.ts               -- AuthError, consumed by middleware/errorHandler.ts
```

## Data model (`types.ts`)

```ts
type User = { username: string; passwordHash: string };
type Session = { token: string; username: string };
```

- `userRepo = createAsyncStore<User>(u => u.username)`
- `sessionRepo = createAsyncStore<Session>(s => s.token)`

`createAsyncStore` currently has no delete operation; it gains one
(`delete(id: string): Promise<void>`, tick + `map.delete`) so `logout` can
remove a session. This is the only change to `asyncStore.ts`.

## Seed data

One demo user seeded in `createApp()`, alongside the existing product/coupon
seeds:

```ts
await userRepo.seed([
  { username: 'admin', passwordHash: bcrypt.hashSync('password123', 10) },
]);
```

## API

### `POST /auth/login`

Body: `{ username: string, password: string }`

1. `userRepo.get(username)`.
2. If found, `bcrypt.compare(password, user.passwordHash)`.
3. On success: generate `crypto.randomUUID()` as the token, `sessionRepo.put({ token, username })`, respond `200 { token }`.
4. On failure (unknown user OR wrong password): throw `AuthError('invalid credentials')`. Both cases produce the identical message/status so the response never reveals whether the username exists.

### `POST /auth/logout`

Reads `Authorization: Bearer <token>` header.

1. If a token is present, `sessionRepo.delete(token)`.
2. Always responds `204`, whether or not the token existed — logout is idempotent.

### `requireAuth` middleware

Applied to `orderRouter` in `app.ts` (`app.use('/orders', requireAuth, orderRouter)`).

1. Read `Authorization: Bearer <token>` header. Missing/malformed → `AuthError('unauthorized')`.
2. `sessionRepo.get(token)`. Not found → `AuthError('unauthorized')`.
3. On success, attach `req.username = session.username` and call `next()`.

## Error handling

New `AuthError extends Error` in `lib/errors.ts` (no extra fields beyond
`message`). `middleware/errorHandler.ts` special-cases it:

```ts
if (err instanceof AuthError) {
  res.status(401).json({ error: err.message });
  return;
}
res.status(400).json({ error: message }); // unchanged default
```

This is the one exception to the existing "everything is 400" rule, added
because 401 is the standard, expected status for auth failures and the
existing scheme had no way to express it.

## Testing

New `src/__tests__/auth.test.ts`:

- login: correct credentials → `200` with a token; wrong password → `401`; unknown username → `401`; both failure cases return the same error message.
- logout: valid token → `204`, and the session is actually gone (subsequent authenticated request with that token → `401`); already-logged-out or unknown token → still `204`.
- `requireAuth` (tested via a protected route, e.g. `/orders/checkout`): no `Authorization` header → `401`; malformed/unknown token → `401`; valid token → request reaches the real handler.

Existing `src/__tests__/checkoutFeature.test.ts` (and any other test hitting
`/orders/*`) needs updating: add a shared test helper that logs in as the
seeded user and returns a valid `Authorization: Bearer <token>` header, then
attach it to every existing request against `/orders`.

Per `CLAUDE.md`, none of this touches the tick-based concurrency behavior of
`asyncStore` — `userRepo`/`sessionRepo` use the same `createAsyncStore` as
every other repository, so no new mocking pattern is introduced.
