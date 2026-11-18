import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Header tiêu đề đơn giản, nền primary — MOB-E2-04.
 * `accessibilityRole="header"` để screen reader nhận diện.
 */
export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: theme.colors.primary, padding: theme.spacing.md }]}>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: theme.colors.primaryText, fontSize: theme.fontSize.lg }]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.colors.primaryText, fontSize: theme.fontSize.sm }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  title: { fontWeight: '700' },
  subtitle: { marginTop: 2, opacity: 0.9 },
});
