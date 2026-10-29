import { describe, expect, it } from 'vitest';
import { actorLabel } from './audit.service';

describe('actorLabel', () => {
  it('có actor → email; sự kiện xác thực/truy cập không actor → Chưa đăng nhập; còn lại → hệ thống', () => {
    expect(actorLabel({ action: 'user.create', actor: { id: 'u', email: 'a@b.c', displayName: 'A' } })).toBe('a@b.c');
    expect(actorLabel({ action: 'auth.login_failed', actor: null })).toBe('Chưa đăng nhập');
    expect(actorLabel({ action: 'access.denied', actor: null })).toBe('Chưa đăng nhập');
    expect(actorLabel({ action: 'report.resolve', actor: null })).toBe('hệ thống');
  });
});
