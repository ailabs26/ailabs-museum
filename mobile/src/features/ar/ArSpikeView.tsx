import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Scene3DErrorBoundary } from '@/features/scene3d/Scene3DErrorBoundary';
import {
  detectDeviceArCapability,
  type ArCapabilityResult,
} from './arCapability';
import {
  loadViroRuntime,
  mapViroTrackingState,
  type ArTrackingQuality,
  type ViroRuntimeComponents,
} from './arBridge';

export interface ArSpikeViewProps {
  /** Cho phép truyền kết quả kiểm tra khả năng AR (tiện cho unit test / mock). */
  capabilityOverride?: ArCapabilityResult;
  viroOverride?: ViroRuntimeComponents | null;
  onFallback3D?: () => void;
  onExit?: () => void;
}

const DEFAULT_SPIKE_POSITION: readonly [number, number, number] = [0, -0.35, -1.2];

/**
 * Màn hình Spike AR (`MOB-E9-01`) sử dụng `@reactvision/react-viro` hỗ trợ ARKit (iOS) & ARCore (Android).
 * Đặt 1 khối mô hình thử nghiệm trước camera; nếu thiết bị không hỗ trợ AR hoặc đang chạy Expo Go,
 * hiển thị hướng dẫn rõ ràng và nút quay về phòng 3D/2D.
 */
export function ArSpikeView({
  capabilityOverride,
  viroOverride,
  onFallback3D,
  onExit,
}: ArSpikeViewProps) {
  const theme = useTheme();
  const capability = useMemo(
    () => capabilityOverride ?? detectDeviceArCapability(),
    [capabilityOverride],
  );
  const viro = useMemo(
    () => (viroOverride !== undefined ? viroOverride : capability.supported ? loadViroRuntime() : null),
    [capability.supported, viroOverride],
  );

  const [tracking, setTracking] = useState<{ quality: ArTrackingQuality; label: string }>({
    quality: 'initializing',
    label: 'Đang khởi tạo phiên AR...',
  });
  const [placed, setPlaced] = useState(true);

  if (!capability.supported || !viro) {
    const message = capability.supported
      ? 'Không tải được runtime @reactvision/react-viro.'
      : capability.userMessage;
    const technical = capability.supported
      ? 'loadViroRuntime() trả về null.'
      : capability.technicalHint;

    return (
      <View
        testID="ar-unsupported-fallback"
        accessible
        accessibilityRole="alert"
        style={[
          styles.fallbackCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.lg,
            padding: theme.spacing.lg,
          },
        ]}
      >
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: theme.colors.text, fontSize: theme.fontSize.lg }]}
        >
          Chế độ AR chưa khả dụng trên môi trường này
        </Text>
        <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.sm, textAlign: 'center' }}>
          {message}
        </Text>
        <Text
          testID="ar-technical-hint"
          style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.xs, textAlign: 'center' }}
        >
          {technical}
        </Text>
        <View style={styles.actions}>
          {onFallback3D ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mở phòng trưng bày 3D thay thế"
              onPress={onFallback3D}
              style={[styles.btn, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md }]}
            >
              <Text style={{ color: theme.colors.primaryText, fontWeight: '600' }}>
                Xem phòng 3D
              </Text>
            </Pressable>
          ) : null}
          {onExit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quay lại màn hình trước"
              onPress={onExit}
              style={[
                styles.btn,
                {
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                },
              ]}
            >
              <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Quay lại</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  const { ViroARSceneNavigator, ViroARScene, ViroAmbientLight, ViroDirectionalLight, ViroBox, ViroNode, ViroText } =
    viro;

  const InitialSpikeScene = () => (
    <ViroARScene
      onTrackingUpdated={(state: number, reason?: number) => {
        setTracking(mapViroTrackingState(state, reason));
      }}
    >
      <ViroAmbientLight color="#FFFFFF" intensity={600} />
      <ViroDirectionalLight color="#FFE8CC" direction={[0, -1, -0.5]} />
      {placed ? (
        <ViroNode position={[...DEFAULT_SPIKE_POSITION]}>
          <ViroBox
            height={0.28}
            width={0.28}
            length={0.28}
            position={[0, 0.14, 0]}
          />
          <ViroText
            text="Aura Museum AR"
            scale={[0.25, 0.25, 0.25]}
            position={[0, 0.42, 0]}
          />
        </ViroNode>
      ) : null}
    </ViroARScene>
  );

  return (
    <View style={styles.root} testID="ar-spike-active">
      <View
        style={[
          styles.statusBar,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            padding: theme.spacing.sm,
          },
        ]}
        accessibilityLiveRegion="polite"
      >
        <Text
          testID="ar-engine-badge"
          style={{ color: theme.colors.primary, fontSize: theme.fontSize.xs, fontWeight: '700' }}
        >
          {capability.engine} · {capability.minOsRequirement} · @reactvision/react-viro
        </Text>
        <Text testID="ar-tracking-status" style={{ color: theme.colors.text, fontSize: theme.fontSize.sm }}>
          {tracking.label}
        </Text>
      </View>

      <View style={[styles.viewport, { borderRadius: theme.radius.lg }]}>
        <Scene3DErrorBoundary
          fallbackTitle="Không thể khởi chạy camera AR"
          onFallback2D={onFallback3D}
        >
          <ViroARSceneNavigator
            autofocus
            initialScene={{ scene: InitialSpikeScene }}
            style={styles.navigator}
          />
        </Scene3DErrorBoundary>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={placed ? 'Ẩn mô hình thử nghiệm AR' : 'Đặt mô hình thử nghiệm AR'}
          onPress={() => setPlaced((prev) => !prev)}
          style={[styles.btn, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md }]}
        >
          <Text style={{ color: theme.colors.primaryText, fontWeight: '600' }}>
            {placed ? 'Ẩn model AR' : 'Đặt model AR'}
          </Text>
        </Pressable>
        {onExit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thoát chế độ AR"
            onPress={onExit}
            style={[
              styles.btn,
              { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md },
            ]}
          >
            <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Thoát AR</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 12 },
  statusBar: { borderWidth: 1, gap: 4 },
  viewport: { flex: 1, minHeight: 300, overflow: 'hidden', backgroundColor: '#0B0B0B' },
  navigator: { flex: 1 },
  fallbackCard: {
    flex: 1,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: { fontWeight: '700', textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
