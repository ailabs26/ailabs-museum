import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsOnline } from '@/core/network/online-status';
import { useTheme } from '@/theme/ThemeProvider';

export const OFFLINE_MESSAGE = 'Không có mạng — đang hiển thị nội dung đã tải trước đó.';

/**
 * Banner trạng thái mạng toàn app (MOB-E12-01), đặt ở trên cùng và tự chiếm vùng tai thỏ.
 * Khi banner hiện, các màn bên dưới nhận inset trên = 0 để header không bị đệm hai lần.
 * Cây component giữ nguyên khi mạng đổi trạng thái → navigation không bị dựng lại.
 */
export function OfflineAware({ children }: { children: ReactNode }) {
  const online = useIsOnline();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <View style={styles.fill}>
      {online ? null : (
        <View style={{ backgroundColor: theme.colors.text, paddingTop: insets.top }}>
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={{
              color: theme.colors.background,
              fontSize: theme.fontSize.sm,
              paddingVertical: theme.spacing.xs,
              paddingHorizontal: theme.spacing.md,
              textAlign: 'center',
            }}
          >
            {OFFLINE_MESSAGE}
          </Text>
        </View>
      )}
      <SafeAreaInsetsContext.Provider value={online ? insets : { ...insets, top: 0 }}>
        {children}
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
