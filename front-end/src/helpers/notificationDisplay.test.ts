import { describe, expect, it } from 'vitest';
import { BODY_PREVIEW_CHARS, isLongBody, relativeTime } from './notificationDisplay';

describe('relativeTime', () => {
  const now = new Date('2026-11-02T12:00:00Z');
  it('theo mốc phút / giờ / ngày, quá 7 ngày → ngày tháng', () => {
    expect(relativeTime('2026-11-02T11:59:30Z', now)).toBe('Vừa xong');
    expect(relativeTime('2026-11-02T11:55:00Z', now)).toBe('5 phút trước');
    expect(relativeTime('2026-11-02T09:00:00Z', now)).toBe('3 giờ trước');
    expect(relativeTime('2026-10-31T12:00:00Z', now)).toBe('2 ngày trước');
    expect(relativeTime('2026-10-20T12:00:00Z', now)).toBe('20/10/2026');
  });
});

describe('isLongBody', () => {
  it('rỗng → không; ngắn → không; quá ngưỡng ký tự hoặc quá 2 dòng → có', () => {
    expect(isLongBody(null)).toBe(false);
    expect(isLongBody('Thiếu nguồn')).toBe(false);
    expect(isLongBody('a'.repeat(BODY_PREVIEW_CHARS))).toBe(false);
    expect(isLongBody('a'.repeat(BODY_PREVIEW_CHARS + 1))).toBe(true);
    expect(isLongBody('1\n2\n3')).toBe(true);
  });
});
