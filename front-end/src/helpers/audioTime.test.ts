import { describe, expect, it } from 'vitest';
import { clampAudioTime, formatAudioTime, getSeekDuration } from './audioTime';

describe('audio timeline values', () => {
  it.each([[0, '00:00'], [74.9, '01:14'], [3601, '01:00:01'], [-1, '00:00'], [NaN, '00:00'], [Infinity, '00:00']])(
    'formats %s as %s', (seconds, expected) => expect(formatAudioTime(seconds as number)).toBe(expected),
  );
  it.each([0, NaN, Infinity, -1])('rejects unknown or non-positive duration %s', value => {
    expect(getSeekDuration(value)).toBeNull();
  });
  it('accepts finite positive duration without rounding the native value', () => {
    expect(getSeekDuration(180)).toBe(180);
    expect(getSeekDuration(8.25)).toBe(8.25);
  });
  it.each([[-1, 8, 0], [20, 8, 8], [4.5, 8, 4.5], [NaN, 8, 0], [Infinity, 8, 0], [4, NaN, 0], [4, Infinity, 0], [4, -1, 0]])(
    'clamps %s within duration %s to %s', (value, duration, expected) => expect(clampAudioTime(value, duration)).toBe(expected),
  );
});
