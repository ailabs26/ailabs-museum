import { expect, it, vi } from 'vitest';
import { ModelAssetError, describeModelFailure, reportModelFailure } from './modelDiagnostics';

it('classifies HTTP failures without retaining request objects or signed URLs', () => {
  for (const [status, category] of [[403, 'permission'], [404, 'missing'], [502, 'server'], [0, 'network']] as const) {
    const failure = describeModelFailure({ status, message: 'https://secret?token=PRIVATE', config: { Authorization: 'SECRET' } });
    expect(failure.category).toBe(category);
    expect(JSON.stringify(failure)).not.toMatch(/PRIVATE|SECRET|https/);
  }
  expect(describeModelFailure(new ModelAssetError('parse', 'format')).stage).toBe('parse');
});

it('logs only whitelisted diagnostic fields once per reported event', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  reportModelFailure({ artifactId: 'a', roomId: 'r', attempt: 1, stage: 'render', category: 'render' });
  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn.mock.calls[0][1]).toMatchObject({ artifactId: 'a', roomId: 'r', attempt: 1, stage: 'render', category: 'render' });
  warn.mockRestore();
});
