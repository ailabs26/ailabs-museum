import { buildTheme, palette } from './tokens';

describe('buildTheme', () => {
  it('trả theme light mặc định khi scheme null/undefined', () => {
    expect(buildTheme(null).scheme).toBe('light');
    expect(buildTheme(undefined).scheme).toBe('light');
    expect(buildTheme('light').colors.primary).toBe(palette.teal700);
  });

  it('trả theme dark khi scheme = dark với nền tối và primary sáng hơn', () => {
    const dark = buildTheme('dark');
    expect(dark.scheme).toBe('dark');
    expect(dark.colors.background).toBe(palette.black);
    expect(dark.colors.primary).toBe(palette.teal600);
  });

  it('giữ nguyên thang spacing/radius giữa hai scheme', () => {
    expect(buildTheme('light').spacing).toEqual(buildTheme('dark').spacing);
    expect(buildTheme('light').radius.pill).toBe(999);
  });
});
