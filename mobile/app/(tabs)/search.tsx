import { Text } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { useTheme } from '@/theme/ThemeProvider';

/** Màn Tìm kiếm (placeholder) — chức năng do TV3 (MOB-E4) triển khai. */
export default function SearchScreen() {
  const theme = useTheme();
  return (
    <Screen>
      <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '700' }}>
        Tìm kiếm hiện vật
      </Text>
    </Screen>
  );
}
