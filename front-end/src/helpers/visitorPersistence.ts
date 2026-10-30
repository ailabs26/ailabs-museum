import { z } from 'zod';

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type VisitorStorageError = 'invalid' | 'unavailable' | 'limit' | null;
export interface VisitorSnapshot<Value> { value: Value; error: VisitorStorageError }

/** A bounded, versioned browser value. Failed writes remain usable in this document. */
export function createVisitorStore<Value>(key: string, schema: z.ZodType<Value>, initial: Value,
  getStorage: () => BrowserStorage = () => window.localStorage) {
  const envelope = z.object({ version: z.literal(1), value: z.unknown() }).strict();
  let snapshot: VisitorSnapshot<Value> | undefined;
  let hasUnsavedValue = false;
  const listeners = new Set<() => void>();
  const read = (): VisitorSnapshot<Value> => {
    try {
      const raw = getStorage().getItem(key);
      if (raw === null) return { value: initial, error: null };
      if (raw.length > 512_000) return { value: initial, error: 'invalid' };
      const parsed = envelope.safeParse(JSON.parse(raw));
      const value = parsed.success ? schema.safeParse(parsed.data.value) : undefined;
      return value?.success ? { value: value.data, error: null } : { value: initial, error: 'invalid' };
    } catch (error) {
      return { value: initial, error: error instanceof SyntaxError ? 'invalid' : 'unavailable' };
    }
  };
  const getSnapshot = () => snapshot ??= read();
  const publish = (next: VisitorSnapshot<Value>) => {
    snapshot = next;
    listeners.forEach(listener => listener());
  };
  const refresh = () => {
    if (!hasUnsavedValue) publish(read());
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) refresh();
  };

  return {
    getSnapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1 && typeof window !== 'undefined') {
        window.addEventListener('storage', onStorage);
        refresh();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
      };
    },
    update(change: (value: Value) => Value): boolean {
      const previous = getSnapshot();
      const latest = hasUnsavedValue ? previous : read();
      const parsed = schema.safeParse(change(latest.error === 'unavailable' ? previous.value : latest.value));
      if (!parsed.success) {
        publish({ value: previous.value, error: 'limit' });
        return false;
      }
      try {
        getStorage().setItem(key, JSON.stringify({ version: 1, value: parsed.data }));
        hasUnsavedValue = false;
        publish({ value: parsed.data, error: null });
        return true;
      } catch {
        hasUnsavedValue = true;
        publish({ value: parsed.data, error: 'unavailable' });
        return false;
      }
    },
  };
}

export type VisitorStore<Value> = ReturnType<typeof createVisitorStore<Value>>;
