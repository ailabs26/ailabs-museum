import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createVisitorStore } from './visitorPersistence';

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
const schema = z.array(z.string().max(10)).max(2);

describe('visitor persistence', () => {
  it('persists a versioned value and restores it in a new store', () => {
    const storage = memoryStorage();
    const store = createVisitorStore('test', schema, [], () => storage);
    expect(store.update(() => ['first'])).toBe(true);
    expect(JSON.parse(storage.getItem('test')!)).toEqual({ version: 1, value: ['first'] });
    expect(createVisitorStore('test', schema, [], () => storage).getSnapshot().value).toEqual(['first']);
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it.each(['{', '{"version":2,"value":[]}', '{"version":1,"value":[7]}', 'x'.repeat(512_001)])('rejects corrupt, unknown or oversized storage (%#)', (raw) => {
    const storage = memoryStorage();
    storage.setItem('test', raw);
    const store = createVisitorStore('test', schema, [], () => storage);
    expect(store.getSnapshot().value).toEqual([]);
    expect(store.getSnapshot().error).toBe('invalid');
    expect(store.update(() => ['safe'])).toBe(true);
    expect(store.getSnapshot().error).toBeNull();
  });

  it('keeps edits in memory when access or quota fails and retries them', () => {
    const storage = memoryStorage();
    let isBlocked = true;
    const store = createVisitorStore('test', schema, [], () => {
      if (isBlocked) throw new Error('SecurityError');
      return storage;
    });
    expect(store.update(() => ['draft'])).toBe(false);
    expect(store.getSnapshot()).toEqual({ value: ['draft'], error: 'unavailable' });
    isBlocked = false;
    expect(store.update(value => value)).toBe(true);
    expect(createVisitorStore('test', schema, [], () => storage).getSnapshot().value).toEqual(['draft']);
    const quota = createVisitorStore('quota', schema, [], () => ({
      getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); },
    }));
    expect(quota.update(() => ['local'])).toBe(false);
    expect(quota.getSnapshot().value).toEqual(['local']);
  });

  it('reads the latest other-tab value before updating and notifies subscribers', () => {
    const storage = memoryStorage();
    const first = createVisitorStore('test', schema, [], () => storage);
    const second = createVisitorStore('test', schema, [], () => storage);
    first.getSnapshot(); second.getSnapshot();
    let changes = 0;
    const unsubscribe = second.subscribe(() => { changes++; });
    first.update(() => ['one']);
    second.update(value => [...value, 'two']);
    expect(second.getSnapshot().value).toEqual(['one', 'two']);
    expect(changes).toBeGreaterThan(0);
    unsubscribe();
  });

  it('rejects over-limit writes without losing the previous value', () => {
    const store = createVisitorStore('test', schema, [], () => memoryStorage());
    store.update(() => ['one']);
    expect(store.update(() => ['one', 'two', 'three'])).toBe(false);
    expect(store.getSnapshot()).toEqual({ value: ['one'], error: 'limit' });
  });

  it('merges a failed edit with unrelated other-tab changes on retry, including deletion', () => {
    const storage = memoryStorage();
    let isBlocked = false;
    const keyedSchema = z.array(z.object({ id: z.string(), text: z.string() }));
    const first = createVisitorStore('notes', keyedSchema, [], () => ({
      getItem: storage.getItem,
      setItem: (key, value) => { if (isBlocked) throw new Error('Quota'); storage.setItem(key, value); },
    }), (base, local, remote) => {
      const changed = new Set([...base, ...local].filter(item =>
        base.find(value => value.id === item.id)?.text !== local.find(value => value.id === item.id)?.text).map(item => item.id));
      return [...remote.filter(item => !changed.has(item.id)), ...local.filter(item => changed.has(item.id))];
    });
    first.update(() => [{ id: 'old', text: 'delete me' }]);
    isBlocked = true;
    first.update(() => [{ id: 'draft', text: 'A' }]);
    const second = createVisitorStore('notes', keyedSchema, [], () => storage);
    second.update(value => [...value, { id: 'other', text: 'B' }]);
    first.update(value => value.map(item => item.id === 'draft' ? { ...item, text: 'A edited' } : item));
    second.update(value => value.map(item => item.id === 'other' ? { ...item, text: 'B edited' } : item));
    isBlocked = false;
    first.update(value => value);
    expect(createVisitorStore('notes', keyedSchema, [], () => storage).getSnapshot().value).toEqual([
      { id: 'other', text: 'B edited' }, { id: 'draft', text: 'A edited' },
    ]);
  });
});
