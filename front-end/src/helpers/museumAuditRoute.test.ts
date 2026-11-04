import { expect, it } from 'vitest';
import { getAuditNavigationInput } from '../../tests/fixtures/museumAuditRoute';

it('replays a time-indexed route independent of automation sample count', () => {
  expect(getAuditNavigationInput(0)).toEqual({ key: 'a', lookX: 0, lookY: 0 });
  expect(getAuditNavigationInput(1999).key).toBe('a');
  expect(getAuditNavigationInput(2000).key).toBe('d');
  expect(getAuditNavigationInput(4000).key).toBe('a');
  expect(getAuditNavigationInput(2000).lookX).toBeCloseTo(-0.0652825333, 8);
  for (const elapsed of [0, 500, 1000, 1500, 2000]) getAuditNavigationInput(elapsed);
  expect(getAuditNavigationInput(2000).lookX).toBeCloseTo(-0.0652825333, 8);
});
