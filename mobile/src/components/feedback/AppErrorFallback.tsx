import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { ApiException } from '@/core/api/api-error';
import { reportError } from '@/core/observability/sentry';
import { buildTheme } from '@/theme/tokens';

/** Thông điệp thân thiện; không lộ chi tiết kỹ thuật cho người dùng. */
export function describeError(error: Error): string {
  if (error instanceof ApiException && error.isNetworkError) {
    return 'Không có kết nối mạng. Kiểm tra mạng rồi thử lại.';
  }
  return 'Ứng dụng gặp lỗi khi hiển thị màn hình này. Bạn có thể thử lại.';
}

/**
 * Màn lỗi toàn cục (MOB-E12-03) — expo-router hiển thị thay cho route bị lỗi khi render, thay vì crash app.
 * Có thể hiện ra ngoài ThemeProvider/SafeAreaProvider nên tự dựng theme theo hệ điều hành.
 */
export function AppErrorFallback({ error, retry }: ErrorBoundaryProps) {
  const theme = buildTheme(useColorScheme());
  const [retrying, setRetrying] = useState(false);

  useEffect(() => reportError(error), [error]);

  const onRetry = async () => {
    setRetrying(true);
    try {
      await retry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
        },
      ]}
    >
      <Text
        accessibilityRole="header"
        style={{
          color: theme.colors.text,
          fontSize: theme.fontSize.xl,
          fontWeight: theme.fontWeight.bold,
        }}
      >
        Đã xảy ra sự cố
      </Text>
      {/* Trình đọc màn hình đọc ngay lý do lỗi (Android: live region; iOS: role alert). */}
      <Text
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.md, textAlign: 'center' }}
      >
        {describeError(error)}
      </Text>
      {__DEV__ ? (
        <Text style={{ color: theme.colors.danger, fontSize: theme.fontSize.xs }} selectable>
          {error.message}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Thử lại"
        accessibilityState={{ disabled: retrying, busy: retrying }}
        disabled={retrying}
        onPress={onRetry}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radius.md,
            opacity: pressed || retrying ? 0.7 : 1,
          },
        ]}
      >
        <Text
          style={{
            color: theme.colors.primaryText,
            fontSize: theme.fontSize.md,
            fontWeight: theme.fontWeight.semibold,
          }}
        >
          {retrying ? 'Đang thử lại…' : 'Thử lại'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Vùng chạm tối thiểu 48dp (WCAG target size).
  button: {
    minHeight: 48,
    minWidth: 160,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
