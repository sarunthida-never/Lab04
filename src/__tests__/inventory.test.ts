import { reserve, release, available } from '../services/inventoryService';
import { productRepo } from '../repositories/productRepo';

beforeEach(async () => {
  await productRepo.seed([{ sku: 'X', name: 'X', priceCents: 100, stock: 3 }]);
});

describe('inventoryService', () => {
  it('reserves when stock is sufficient', async () => {
    expect(await reserve('X', 2)).toBe(true);
    expect(await available('X')).toBe(1);
  });

  it('refuses when stock is insufficient', async () => {
    expect(await reserve('X', 4)).toBe(false);
    expect(await available('X')).toBe(3);
  });

  it('release puts stock back', async () => {
    await reserve('X', 2);
    await release('X', 2);
    expect(await available('X')).toBe(3);
  });

  it('throws for an unknown sku', async () => {
    await expect(reserve('NOPE', 1)).rejects.toThrow(/unknown sku/);
  });

  it('release throws for an unknown sku', async () => {
    await expect(release('NOPE', 1)).rejects.toThrow(/unknown sku/);
  });

  it('available is 0 for an unknown sku', async () => {
    expect(await available('NOPE')).toBe(0);
  });

  it('CONCURRENCY: two racing reserves of the last unit -> exactly one succeeds', async () => {
    await productRepo.seed([{ sku: 'X', name: 'X', priceCents: 100, stock: 1 }]);
    const results = await Promise.all([reserve('X', 1), reserve('X', 1)]);
    expect(results.filter(Boolean).length).toBe(1);
    expect(await available('X')).toBe(0); // and never negative
  });

  it('CONCURRENCY: many racing reserves never oversell', async () => {
    await productRepo.seed([{ sku: 'X', name: 'X', priceCents: 100, stock: 5 }]);
    const results = await Promise.all(Array.from({ length: 10 }, () => reserve('X', 1)));
    expect(results.filter(Boolean).length).toBe(5);
    expect(await available('X')).toBe(0);
  });
});
