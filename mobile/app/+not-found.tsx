import { Link, Stack } from 'expo-router';
import { Text } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { useTheme } from '@/theme/ThemeProvider';

/** Màn 404 cho route không tồn tại (MOB-E1-03). */
export default function NotFoundScreen() {
  const theme = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Không tìm thấy' }} />
      <Screen>
        <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '700' }}>
          Trang không tồn tại.
        </Text>
        <Link href="/" style={{ color: theme.colors.primary, fontSize: theme.fontSize.md }}>
          → Về trang chủ
        </Link>
      </Screen>
    </>
  );
}
