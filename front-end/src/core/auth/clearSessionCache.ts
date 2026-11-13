import type { Query, QueryClient } from '@tanstack/react-query';

/** Session cleanup: private data must never survive a session reset. */
export function clearSessionCache(client: QueryClient, preservePublic = false): void {
  const filters = { predicate: (query: Query) => !preservePublic || query.meta?.public !== true };
  void client.cancelQueries(filters);
  client.removeQueries(filters);
  client.getMutationCache().clear();
}
