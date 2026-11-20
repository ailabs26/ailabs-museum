import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Scene3DErrorBoundary } from './Scene3DErrorBoundary';
import { SPIKE_CUBE_COLORS, SpinningCubeScene } from './SpinningCubeScene';
import type { FpsSnapshot } from './fpsMeter';

const EMPTY_FPS: FpsSnapshot = {
  fps: 0,
  frameTimeMs: 0,
  p95FrameTimeMs: 0,
  droppedFrames16ms: 0,
  droppedFrames33ms: 0,
  sampleCount: 0,
  meets60FpsTarget: false,
};

export interface ThreeSpikeViewProps {
  /** Cho phép truyền nút quay về 2D từ màn cha khi thiết bị không hỗ trợ GL. */
  onFallback2D?: () => void;
}

/**
 * Màn hình Spike 3D (`MOB-E6-01`): render cube xoay bằng R3F Native + Expo GL,
 * tự động tạm dừng khi app vào nền hoặc khi hệ điều hành bật Giảm chuyển động.
 */
export function ThreeSpikeView({ onFallback2D }: ThreeSpikeViewProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [userPaused, setUserPaused] = useState(false);
  const [backgroundPaused, setBackgroundPaused] = useState(false);
  const [colorIndex, setColorIndex] = useState(0);
  const [resetNonce, setResetNonce] = useState(0);
  const [fps, setFps] = useState<FpsSnapshot>(EMPTY_FPS);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setBackgroundPaused(nextState !== 'active');
    });
    return () => subscription.remove();
  }, []);

  const paused = userPaused || backgroundPaused;

  const handleFpsSample = useCallback((snapshot: FpsSnapshot) => {
    setFps(snapshot);
  }, []);

  const handleCycleColor = useCallback(() => {
    setColorIndex((prev) => (prev + 1) % SPIKE_CUBE_COLORS.length);
  }, []);

  const handleReset = useCallback(() => {
    setUserPaused(false);
    setColorIndex(0);
    setResetNonce((prev) => prev + 1);
  }, []);

  const statusText = reducedMotion
    ? 'Giảm chuyển động (OS)'
    : paused
      ? 'Đang tạm dừng'
      : fps.meets60FpsTarget
        ? 'Ổn định 60 FPS'
        : fps.sampleCount > 0
          ? 'Đang đo hiệu năng'
          : 'Đang khởi tạo GL';

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.hudCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            padding: theme.spacing.sm,
          },
        ]}
        accessibilityLiveRegion="polite"
      >
        <View style={styles.hudRow}>
          <Text
            testID="spike-fps-value"
            style={[styles.fpsValue, { color: theme.colors.primary, fontSize: theme.fontSize.lg }]}
          >
            {fps.sampleCount > 0 ? `${fps.fps.toFixed(1)} FPS` : '-- FPS'}
          </Text>
          <Text
            testID="spike-status-badge"
            style={[styles.statusText, { color: theme.colors.textMuted, fontSize: theme.fontSize.xs }]}
          >
            {statusText}
          </Text>
        </View>
        <Text
          testID="spike-metrics-detail"
          style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.xs }}
        >
          Frame: {fps.frameTimeMs.toFixed(1)} ms · p95: {fps.p95FrameTimeMs.toFixed(1)} ms · Rớt &gt;16.7ms:{' '}
          {fps.droppedFrames16ms} ({fps.sampleCount} mẫu)
        </Text>
      </View>

      <View style={[styles.viewport, { borderRadius: theme.radius.lg }]}>
        <Scene3DErrorBoundary onFallback2D={onFallback2D}>
          <SpinningCubeScene
            paused={paused}
            reducedMotion={reducedMotion}
            colorIndex={colorIndex}
            resetNonce={resetNonce}
            onFpsSample={handleFpsSample}
            onCubePress={handleCycleColor}
          />
        </Scene3DErrorBoundary>
      </View>

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={userPaused ? 'Tiếp tục xoay khối lập phương' : 'Tạm dừng xoay khối lập phương'}
          disabled={reducedMotion}
          onPress={() => setUserPaused((prev) => !prev)}
          style={[
            styles.button,
            {
              backgroundColor: reducedMotion ? theme.colors.border : theme.colors.primary,
              borderRadius: theme.radius.md,
            },
          ]}
        >
          <Text style={[styles.buttonText, { color: theme.colors.primaryText }]}>
            {userPaused ? 'Tiếp tục' : 'Tạm dừng'}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đổi màu khối lập phương"
          onPress={handleCycleColor}
          style={[
            styles.button,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderWidth: 1,
              borderRadius: theme.radius.md,
            },
          ]}
        >
          <Text style={[styles.buttonText, { color: theme.colors.text }]}>Đổi màu</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đặt lại góc xoay và thông số đo FPS"
          onPress={handleReset}
          style={[
            styles.button,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderWidth: 1,
              borderRadius: theme.radius.md,
            },
          ]}
        >
          <Text style={[styles.buttonText, { color: theme.colors.text }]}>Đặt lại</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: 12,
  },
  hudCard: {
    borderWidth: 1,
    gap: 4,
  },
  hudRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fpsValue: {
    fontWeight: '700',
  },
  statusText: {
    fontWeight: '600',
  },
  viewport: {
    flex: 1,
    minHeight: 280,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  controls: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
