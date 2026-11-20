import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Màn Phòng (placeholder) — minh họa điều hướng sang nested stack `room/[slug]`.
 * Danh sách phòng thực do TV3 (MOB-E4-02) triển khai.
 */
export default function RoomsScreen() {
  const theme = useTheme();
  return (
    <Screen>
      <View style={{ gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '700' }}>
          Danh sách phòng
        </Text>
        <Link href="/room/demo-room" style={{ color: theme.colors.primary, fontSize: theme.fontSize.md }}>
          → Mở phòng demo (nested stack)
        </Link>
        <Link href="/spike-3d" style={{ color: theme.colors.primary, fontSize: theme.fontSize.md }}>
          → Mở Spike 3D Cube (MOB-E6-01)
        </Link>
        <Link
          href="/glb-preview"
          style={{ color: theme.colors.primary, fontSize: theme.fontSize.md }}
        >
          → Mở kiểm thử GLB + Cache (MOB-E6-02)
        </Link>
        <Link
          href="/spike-ar"
          style={{ color: theme.colors.primary, fontSize: theme.fontSize.md }}
        >
          → Mở Spike AR iOS/Android (MOB-E9-01)
        </Link>
        <Link
          href="/ar-exhibit"
          style={{ color: theme.colors.primary, fontSize: theme.fontSize.md }}
        >
          → Mở đặt hiện vật AR lên mặt phẳng (MOB-E9-02/03)
        </Link>
      </View>
    </Screen>
  );
}
