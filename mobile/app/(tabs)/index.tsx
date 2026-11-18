import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { AppHeader } from '@/components/layout/AppHeader';
import { useTheme } from '@/theme/ThemeProvider';
import { appConfig } from '@/config/env';

/** Màn Trang chủ (placeholder nền tảng) — nội dung thực do TV3 triển khai. */
export default function HomeScreen() {
  const theme = useTheme();
  return (
    <Screen style={styles.noPad}>
      <AppHeader title="Aura Museum" subtitle="Bảo tàng WebXR tương tác" />
      <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.md }}>
          Khung ứng dụng mobile đã sẵn sàng. Môi trường: {appConfig.appEnv}.
        </Text>
        <Link href="/rooms" style={{ color: theme.colors.primary, fontSize: theme.fontSize.md }}>
          → Xem danh sách phòng
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ noPad: { padding: 0 } });
