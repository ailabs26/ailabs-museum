import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing, fontSize } from '@/theme/tokens';

export interface Scene3DErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onError?: (error: Error, info: ErrorInfo) => void;
  onFallback2D?: () => void;
}

interface Scene3DErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

/**
 * ErrorBoundary bảo vệ khung cảnh 3D/GL — MOB-E6-01.
 * Nếu `expo-gl` hoặc renderer gặp lỗi thiết bị, hiển thị giao diện 2D an toàn kèm nút thử lại.
 */
export class Scene3DErrorBoundary extends Component<
  Scene3DErrorBoundaryProps,
  Scene3DErrorBoundaryState
> {
  override state: Scene3DErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
  };

  static getDerivedStateFromError(error: Error): Scene3DErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Không thể khởi tạo ngữ cảnh đồ họa 3D (WebGL/Expo GL).',
    };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn('[scene3d:boundary]', error.message);
    this.props.onError?.(error, info);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, errorMessage: null });
  };

  override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View
        accessible
        accessibilityRole="alert"
        testID="scene3d-error-fallback"
        style={styles.container}
      >
        <Text accessibilityRole="header" style={styles.title}>
          {this.props.fallbackTitle ?? 'Không thể hiển thị khung cảnh 3D'}
        </Text>
        <Text style={styles.message}>
          {this.props.fallbackMessage ?? this.state.errorMessage}
        </Text>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thử khởi tạo lại khung cảnh 3D"
            onPress={this.handleRetry}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryLabel}>Thử lại 3D</Text>
          </Pressable>
          {this.props.onFallback2D ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chuyển sang chế độ xem 2D"
              onPress={this.props.onFallback2D}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryLabel}>Xem chế độ 2D</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: palette.gray900,
    borderRadius: radius.lg,
  },
  title: {
    color: palette.white,
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: palette.gray200,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  primaryButton: {
    backgroundColor: palette.teal600,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  primaryLabel: {
    color: palette.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: palette.gray500,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryLabel: {
    color: palette.gray50,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
