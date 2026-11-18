import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Bọc màn hình trong SafeArea + nền theo theme — MOB-E2-04.
 * Mặc định chừa an toàn trên/dưới (notch, home indicator).
 */
export function Screen({
  children,
  edges = ['top', 'bottom'],
  style,
}: {
  children: ReactNode;
  edges?: readonly Edge[];
  style?: ViewStyle;
}) {
  const theme = useTheme();
  return (
    <SafeAreaView
      edges={edges}
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
    >
      <View style={[styles.content, { padding: theme.spacing.md }, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1 },
});
