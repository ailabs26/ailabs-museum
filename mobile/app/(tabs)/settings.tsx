import { Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { useTheme } from '@/theme/ThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { appConfig } from '@/config/env';

/** Màn Cài đặt (placeholder) — hiển thị trạng thái môi trường và reduce motion. */
export default function SettingsScreen() {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  return (
    <Screen>
      <View style={{ gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '700' }}>
          Cài đặt
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
          Giao diện: {theme.scheme === 'dark' ? 'Tối' : 'Sáng'}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
          Giảm chuyển động: {reducedMotion ? 'Bật' : 'Tắt'}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
          Môi trường: {appConfig.appEnv}
        </Text>
      </View>
    </Screen>
  );
}
