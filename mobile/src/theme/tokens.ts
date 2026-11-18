/**
 * Design tokens cho mobile, đồng bộ brand với web (teal #0F766E) — MOB-E2-01, MOB-E2-05.
 * `buildTheme` là pure function để unit test và tránh phụ thuộc React.
 */
export type ColorScheme = 'light' | 'dark';

export const palette = {
  teal900: '#134E4A',
  teal800: '#115E59',
  teal700: '#0F766E',
  teal600: '#0D9488',
  teal100: '#CCFBF1',
  white: '#FFFFFF',
  black: '#0B0B0B',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray500: '#6B7280',
  gray700: '#374151',
  gray900: '#111827',
  red600: '#DC2626',
} as const;

/** Thang spacing 4px — dùng chung toàn app. */
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const fontSize = { xs: 12, sm: 14, md: 16, lg: 20, xl: 24, xxl: 32 } as const;

export const fontWeight = { regular: '400', medium: '500', semibold: '600', bold: '700' } as const;

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  border: string;
  danger: string;
}

export interface Theme {
  scheme: ColorScheme;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
}

const lightColors: ThemeColors = {
  background: palette.gray50,
  surface: palette.white,
  text: palette.gray900,
  textMuted: palette.gray500,
  primary: palette.teal700,
  primaryText: palette.white,
  border: palette.gray200,
  danger: palette.red600,
};

const darkColors: ThemeColors = {
  background: palette.black,
  surface: palette.gray900,
  text: palette.gray50,
  textMuted: palette.gray200,
  primary: palette.teal600,
  primaryText: palette.white,
  border: palette.gray700,
  danger: palette.red600,
};

/** Trả theme theo color scheme; mặc định light khi scheme null/không xác định. */
export function buildTheme(scheme: ColorScheme | null | undefined): Theme {
  const resolved: ColorScheme = scheme === 'dark' ? 'dark' : 'light';
  return {
    scheme: resolved,
    colors: resolved === 'dark' ? darkColors : lightColors,
    spacing,
    radius,
    fontSize,
    fontWeight,
  };
}
