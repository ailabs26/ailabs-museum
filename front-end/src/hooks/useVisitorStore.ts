import { useSyncExternalStore } from 'react';
import type { VisitorStore } from '@/helpers/visitorPersistence';

export function useVisitorStore<Value>(store: VisitorStore<Value>) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
