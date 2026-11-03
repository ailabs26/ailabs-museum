import { describe, expect, it } from 'vitest';
import { passwordError, passwordRules, passwordScore } from './passwordPolicy';

describe('passwordPolicy (FE)', () => {
  it('khớp quy tắc back-end: độ dài theo ký tự, 72 byte, chữ + số, không chứa email/tên (bỏ dấu)', () => {
    expect(passwordError('hoangth12')).toBe('Mật khẩu tối thiểu 10 ký tự');
    expect(passwordError('chicochuthoi')).toBe('Mật khẩu phải có cả chữ và số');
    expect(passwordError(`a1${'x'.repeat(71)}`)).toBe('Mật khẩu quá dài (tối đa 72 byte)');
    expect(passwordError('xyz-thang-77x', { displayName: 'Nguyễn Văn Thắng' })).toBe('Mật khẩu không được chứa email hoặc tên');
    expect(passwordError('hoa-binh-sen-7x', { email: 'thang@aura.local', displayName: 'Nguyễn Văn Thắng' })).toBeNull();
  });

  it('danh sách quy tắc trả trạng thái đạt/chưa đạt từng mục', () => {
    expect(passwordRules('abc').map((r) => [r.id, r.ok])).toEqual([
      ['length', false], ['bytes', true], ['letterDigit', false], ['personal', true],
    ]);
  });

  it('điểm: chưa đạt quy tắc ≤ 30; đạt thì tăng theo độ dài và độ đa dạng, tối đa 100', () => {
    expect(passwordScore('')).toBe(0);
    expect(passwordScore('abc1')).toBeLessThanOrEqual(30);
    const base = passwordScore('hoabinhsen7');
    expect(base).toBeGreaterThanOrEqual(40);
    expect(passwordScore('Hoa-Binh-Sen-Ven-Ho-7')).toBeGreaterThan(base);
    expect(passwordScore('Aa1!'.repeat(15))).toBe(100);
  });
});
