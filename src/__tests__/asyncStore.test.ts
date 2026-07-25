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
