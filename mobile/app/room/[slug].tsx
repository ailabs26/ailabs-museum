import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Màn chi tiết phòng trên nested stack (demo deep link `/room/:slug`) — MOB-E1-03.
 * Nội dung 3D/catalogue thực do TV4/TV3 triển khai (MOB-E4, MOB-E6).
 */
export default function RoomDetailScreen() {
  const theme = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return (
    <Screen>
      <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '700' }}>
        Phòng: {slug}
      </Text>
      <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
        (Màn nền tảng — catalogue và trải nghiệm 3D sẽ bổ sung sau.)
      </Text>
    </Screen>
  );
}
