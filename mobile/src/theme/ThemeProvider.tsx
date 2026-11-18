import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { buildTheme, type Theme } from './tokens';

const ThemeContext = createContext<Theme>(buildTheme('light'));

/**
 * Cung cấp theme theo color scheme của hệ điều hành (dark mode tự động) — MOB-E2-05.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const theme = useMemo(() => buildTheme(scheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** Hook đọc theme hiện tại trong component. */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}
