import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { clearSessionCache } from './clearSessionCache';

describe('clearSessionCache', () => {
  it('preserves only explicitly public data on an initial anonymous session failure', async () => {
    const client = new QueryClient();
    await client.fetchQuery({ queryKey: ['museum-tour', 'rooms'], meta: { public: true }, queryFn: () => ['public room'] });
    await client.fetchQuery({ queryKey: ['users'], queryFn: () => ['private user'] });
    await client.fetchQuery({ queryKey: ['private'], meta: { public: false }, queryFn: () => 'secret' });
    client.getMutationCache().build(client, { mutationKey: ['edit'] });
    clearSessionCache(client, true);
    expect(client.getQueryData(['museum-tour', 'rooms'])).toEqual(['public room']);
    expect(client.getQueryData(['users'])).toBeUndefined();
    expect(client.getQueryData(['private'])).toBeUndefined();
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    client.clear();
  });
  it('clears both public and private caches when a real session ends', async () => {
    const client = new QueryClient();
    await client.fetchQuery({ queryKey: ['museum-tour'], meta: { public: true }, queryFn: () => 'public' });
    await client.fetchQuery({ queryKey: ['private'], queryFn: () => 'secret' });
    clearSessionCache(client);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
  it('aborts private work but lets an anonymous public request finish', async () => {
    const client = new QueryClient();
    let publicSignal!: AbortSignal;
    let privateSignal!: AbortSignal;
    let finishPublic!: (data: string) => void;
    const publicWork = client.fetchQuery({ queryKey: ['public'], meta: { public: true }, queryFn: ({ signal }) => {
      publicSignal = signal;
      return new Promise<string>((resolve) => { finishPublic = resolve; });
    } });
    const privateWork = client.fetchQuery({ queryKey: ['private'], queryFn: ({ signal }) => {
      privateSignal = signal;
      return new Promise(() => {});
    } }).catch(() => undefined);
    // Attach a rejection handler before intentionally cancelling in the RED run.
    void publicWork.catch(() => undefined);
    clearSessionCache(client, true);
    expect(privateSignal.aborted).toBe(true);
    expect(publicSignal.aborted).toBe(false);
    finishPublic('published');
    expect(await publicWork).toBe('published');
    await privateWork;
    expect(client.getQueryData(['private'])).toBeUndefined();
    client.clear();
  });
});
