# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`checkout-service` — this is the **solution branch** of a training lab (Claude Code Bootcamp, Lab B). It's a small Express/TypeScript checkout API. Money is always integer cents (`Cents = number`), never floats. Repositories are async in-memory stores that `await` a tick on every operation, so concurrency bugs in callers are actually observable in tests instead of masked by same-tick execution.

## Commands

```bash
npm install
npm run build       # tsc — must compile clean
npm test            # jest — all tests must be green
npm run typecheck   # tsc --noEmit
npm run dev          # tsx watch src/index.ts, http://localhost:3000
```

Run a single test file: `npx jest src/__tests__/inventory.test.ts`
Run tests matching a name: `npx jest -t "race"`

## Architecture

Request flow: `routes/` → `services/` → `repositories/`. Routes only translate HTTP <-> service calls and delegate errors to `next(err)`; `middleware/errorHandler.ts` turns any thrown `Error` into a `400` with `{ error: message }` — there's no status-code-per-error-type scheme, so don't invent one without checking whether it's actually needed.

**Repositories** (`repositories/*.ts`) are all built from the single `createAsyncStore<T>(key)` factory in `repositories/asyncStore.ts`. Every `get`/`put`/`all` awaits a `setTimeout(0)` tick before touching the underlying `Map`. This is intentional: it's what makes check-then-act races between concurrent requests reproducible in tests. Don't "optimize" this away.

**Concurrency control** — `lib/locks.ts` exports one primitive, `withLock<T>(key, fn)`: a per-key async mutex built by chaining promises in a `Map<string, Promise>`. Two call sites depend on it:
- `services/inventoryService.ts`: `reserve`/`release` wrap their read-check-write in `withLock('sku:'+sku)` so two concurrent reservations against the last unit of stock can't both succeed (the historical bug: check-then-act across an `await` with no lock → oversell).
- `services/orderService.ts`: the whole `checkout()` body is wrapped in `withLock('idem:'+idempotencyKey)` when a key is supplied, serializing concurrent retries with the same key.

If you add a new piece of shared mutable state that gets read-then-written across an `await`, it needs the same lock treatment or it will race.

**Checkout orchestration** (`services/orderService.ts`, function `doCheckout`) runs in a fixed order that matters:
1. Resolve coupon (unknown/missing code → no discount, never throws)
2. Price the cart (`pricingService.priceCart`, coupon's discount folded in)
3. Reserve stock line by line; if a later line fails, **release everything already reserved** for this checkout before throwing (rollback — easy to forget)
4. Persist the order

**Idempotency** (`checkout()` wrapping `doCheckout`): when `Idempotency-Key` is present, the key is checked *before* work starts and recorded *only after* the order is successfully persisted. Recording before `reserve` would mean a failed attempt could never be retried. The whole operation for a given key is serialized via `withLock`, so concurrent retries with the same key still only produce one order and one stock deduction.

**Coupons** (`services/couponService.ts`, `discountForCoupon`): pure function, takes an injectable `Clock` (`lib/clock.ts`) instead of calling `Date.now()` directly, so expiry tests are deterministic (`fixedClock(iso)`). Rules: null coupon → 0; expired (`expiresAt <= now`) → 0; `subtotal < minSubtotalCents` → 0; `percent` uses `percentOf` (half-up rounding); `fixed` is a flat cents value; result is always clamped to `[0, subtotal]`.

**Money** (`lib/money.ts`): all arithmetic on cents; `percentOf` and tax (`pricingService.taxOf`, 7% = 700 bps) round half-up via `Math.round`. Never introduce floating-point currency math.

## Working in this repo

- This solution already implements everything described in `docs/ASSIGNMENTS.md` (Dev track: coupons + idempotent checkout; QA track: race-condition fix + tests in `inventoryService`) and `SOLUTION.md` documents the diff against the student starter repo, per file, with the reasoning graders should check for. Read `SOLUTION.md` before changing `locks.ts`, `inventoryService.ts`, `couponService.ts`, or `orderService.ts` — it explains *why* the current shape was chosen (e.g. why idempotency keys are recorded after success, not before).
- Tests in `src/__tests__/inventory.test.ts` and `checkoutFeature.test.ts` assert on race conditions using real concurrent `Promise.all` calls against the tick-based async stores — don't replace these with mocks that resolve synchronously, that would hide the exact bug the lab is about.
