import { useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Scene3DErrorBoundary } from '@/features/scene3d/Scene3DErrorBoundary';
import type { GlbCacheAdapter } from '@/features/scene3d/glbCache';
import type { ModelNormalization } from '@/features/scene3d/glbValidation';
import type { MuseumDisplay } from '@/features/scene3d/museumTypes';
import {
  detectDeviceArCapability,
  type ArCapabilityResult,
} from './arCapability';
import {
  loadViroRuntime,
  mapViroTrackingState,
  type ViroRuntimeComponents,
} from './arBridge';
import {
  prepareArGlbSource,
  type PrepareArGlbOptions,
  type PreparedArGlbSource,
} from './arModelSource';
import {
  arPlacementReducer,
  computeArModelTransform,
  createInitialArPlacementState,
  type ArPlacementAction,
  type ArPlacementState,
} from './arPlacementMath';

export interface PlacedArNodeContext {
  viro: ViroRuntimeComponents;
  placement: ArPlacementState;
  exhibit: MuseumDisplay;
}

export interface ArArtifactPlacementViewProps {
  exhibit: MuseumDisplay;
  apiBaseUrl?: string;
  cache?: GlbCacheAdapter;
  fetchImpl?: PrepareArGlbOptions['fetchImpl'];
  sha256Impl?: PrepareArGlbOptions['sha256Impl'];
  normalizationImpl?: PrepareArGlbOptions['normalizationImpl'];
  onModelPrepared?: (normalization: ModelNormalization) => void;
  capabilityOverride?: ArCapabilityResult;
  viroOverride?: ViroRuntimeComponents | null;
  /** Điểm mở rộng cho MOB-E9-03 gắn marker hotspot 3D lên hiện vật đã đặt trong AR. */
  renderPlacedSceneChildren?: (ctx: PlacedArNodeContext) => ReactNode;
  /** Điểm mở rộng cho MOB-E9-03 gắn thẻ story/hotspot HUD trên màn hình. */
  renderPlacedOverlay?: (placement: ArPlacementState) => ReactNode;
  onFallback3D?: () => void;
  onExit?: () => void;
}

type ModelPrepState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; prepared: PreparedArGlbSource }
  | { status: 'error'; message: string };

interface PlacementSceneProps {
  viro: ViroRuntimeComponents;
  placement: ArPlacementState;
  dispatch: Dispatch<ArPlacementAction>;
  exhibit: MuseumDisplay;
  placedUri: string | null;
  normalization: ModelNormalization | null;
  renderPlacedSceneChildren?: (ctx: PlacedArNodeContext) => ReactNode;
}

// Viro giữ `initialScene` từ lúc navigator khởi tạo. Trạng thái thay đổi phải đi qua
// viroAppProps, không được đóng trong một component tạo lại ở mỗi lần render.
function PlacementArScene({ arSceneNavigator }: { arSceneNavigator: { viroAppProps: PlacementSceneProps } }) {
  const { viro, placement, dispatch, exhibit, placedUri, normalization, renderPlacedSceneChildren } = arSceneNavigator.viroAppProps;
  const {
    ViroARScene, ViroARPlaneSelector, ViroAmbientLight, ViroDirectionalLight,
    ViroNode, Viro3DObject, ViroBox,
  } = viro;
  const modelTransform = computeArModelTransform(placement.scale);
  const fitTransform = normalization ? computeArModelTransform(1, normalization) : null;

  return (
    <ViroARScene
      onTrackingUpdated={(stateCode: number, reasonCode?: number) => {
        const mapped = mapViroTrackingState(stateCode, reasonCode);
        dispatch({ type: 'TRACKING_UPDATED', quality: mapped.quality, message: mapped.label });
      }}
      onAnchorFound={() => dispatch({ type: 'PLANE_DETECTED' })}
    >
      <ViroAmbientLight color="#FFFFFF" intensity={650} />
      <ViroDirectionalLight color="#FFE8CC" direction={[0, -1, -0.4]} />
      <ViroARPlaneSelector
        alignment="Horizontal"
        maxPlanes={5}
        onPlaneSelected={(anchorMap: { position?: [number, number, number] }) => {
          dispatch({ type: 'PLACE_AT', position: anchorMap?.position ?? [0, -0.4, -1.2] });
        }}
      >
        {placement.status === 'placed' ? (
          <ViroNode
            position={[0, 0, 0]}
            rotation={[0, placement.rotationYDeg, 0]}
            scale={modelTransform.scale}
            onPinch={(pinchState: number, scaleFactor: number) =>
              dispatch({ type: 'PINCH_GESTURE', gestureState: pinchState, scaleFactor })}
            onRotate={(rotateState: number, rotationFactor: number) =>
              dispatch({ type: 'ROTATE_GESTURE', gestureState: rotateState, rotationFactorDeg: rotationFactor })}
          >
            {placedUri && fitTransform ? (
              <ViroNode position={fitTransform.positionOffset} scale={fitTransform.scale}>
                <Viro3DObject source={{ uri: placedUri }} type="GLB" />
              </ViroNode>
            ) : (
              <ViroBox width={0.32} height={0.32} length={0.32} position={[0, 0.16, 0]} />
            )}
            {renderPlacedSceneChildren?.({ viro, placement, exhibit })}
          </ViroNode>
        ) : null}
      </ViroARPlaneSelector>
    </ViroARScene>
  );
}

/**
 * Màn hình đặt hiện vật lên mặt phẳng ngang AR kèm xoay 360° & phóng to/thu nhỏ ổn định
 * (MOB-E9-02). Tái sử dụng cache GLB `MOB-E6-02` và có thanh nút điều khiển 1 tay / a11y.
 */
export function ArArtifactPlacementView({
  exhibit,
  apiBaseUrl,
  cache,
  fetchImpl,
  sha256Impl,
  normalizationImpl,
  onModelPrepared,
  capabilityOverride,
  viroOverride,
  renderPlacedSceneChildren,
  renderPlacedOverlay,
  onFallback3D,
  onExit,
}: ArArtifactPlacementViewProps) {
  const theme = useTheme();
  const capability = useMemo(
    () => capabilityOverride ?? detectDeviceArCapability(),
    [capabilityOverride],
  );
  const viro = useMemo(
    () => (viroOverride !== undefined ? viroOverride : capability.supported ? loadViroRuntime() : null),
    [capability.supported, viroOverride],
  );

  const [placement, dispatch] = useReducer(arPlacementReducer, undefined, () =>
    createInitialArPlacementState(),
  );
  const [modelPrep, setModelPrep] = useState<ModelPrepState>(
    exhibit.model ? { status: 'loading' } : { status: 'idle' },
  );

  useEffect(() => {
    if (!exhibit.model || !capability.supported) {
      setModelPrep({ status: 'idle' });
      return;
    }
    const controller = new AbortController();
    let active = true;
    setModelPrep({ status: 'loading' });

    prepareArGlbSource({
      model: exhibit.model,
      apiBaseUrl,
      cache,
      fetchImpl,
      sha256Impl,
      normalizationImpl,
      signal: controller.signal,
    })
      .then((prepared) => {
        if (active) {
          setModelPrep({ status: 'ready', prepared });
          onModelPrepared?.(prepared.normalization);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setModelPrep({
          status: 'error',
          message:
            error instanceof Error ? error.message : 'Không tải được tệp GLB cho chế độ AR.',
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [exhibit.model, capability.supported, apiBaseUrl, cache, fetchImpl, sha256Impl, normalizationImpl, onModelPrepared]);

  if (!capability.supported || !viro) {
    return (
      <View
        testID="ar-placement-unsupported"
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
          style={{ color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '700', textAlign: 'center' }}
        >
          Không thể mở AR cho “{exhibit.title}”
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm, textAlign: 'center' }}>
          {capability.supported
            ? 'Không tải được runtime @reactvision/react-viro.'
            : capability.userMessage}
        </Text>
        <View style={styles.btnRow}>
          {onFallback3D ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xem hiện vật trong phòng 3D"
              onPress={onFallback3D}
              style={[styles.btn, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md }]}
            >
              <Text style={{ color: theme.colors.primaryText, fontWeight: '600' }}>Xem phòng 3D</Text>
            </Pressable>
          ) : null}
          {onExit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thoát chế độ AR"
              onPress={onExit}
              style={[styles.btn, { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md }]}
            >
              <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Quay lại</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  const { ViroARSceneNavigator } = viro;
  const placedUri = modelPrep.status === 'ready' ? modelPrep.prepared.localUri : null;

  const statusHeadline =
    placement.status === 'placed'
      ? `Đã đặt · Tỷ lệ ${Math.round(placement.scale * 100)}% · Xoay ${Math.round(placement.rotationYDeg)}°`
      : placement.status === 'plane_detected'
        ? `Phát hiện ${placement.planeCount} mặt phẳng — chạm vào mặt phẳng để đặt hiện vật`
        : placement.trackingMessage;

  return (
    <View style={styles.root} testID="ar-placement-active">
      <View
        style={[
          styles.statusCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            padding: theme.spacing.sm,
          },
        ]}
        accessibilityLiveRegion="polite"
      >
        <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.md, fontWeight: '700' }}>
          {exhibit.title}
        </Text>
        <Text testID="ar-placement-status" style={{ color: theme.colors.primary, fontSize: theme.fontSize.xs, fontWeight: '600' }}>
          {statusHeadline}
        </Text>
        {modelPrep.status === 'loading' ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.xs }}>
              Đang chuẩn bị GLB từ bộ nhớ đệm...
            </Text>
          </View>
        ) : modelPrep.status === 'ready' ? (
          <Text testID="ar-model-source" style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.xs }}>
            GLB AR: {modelPrep.prepared.source === 'cache' ? 'Bộ nhớ đệm cục bộ' : 'Đã tải & lưu đệm'}
          </Text>
        ) : modelPrep.status === 'error' ? (
          <Text testID="ar-model-error" style={{ color: theme.colors.danger, fontSize: theme.fontSize.xs }}>
            {modelPrep.message} (đang dùng hình khối dự phòng)
          </Text>
        ) : null}
      </View>

      <View style={[styles.viewport, { borderRadius: theme.radius.lg }]}>
        <Scene3DErrorBoundary
          fallbackTitle="Lỗi camera AR"
          onFallback2D={onFallback3D}
        >
          <ViroARSceneNavigator
            autofocus
            initialScene={{ scene: PlacementArScene }}
            viroAppProps={{ viro, placement, dispatch, exhibit, placedUri,
              normalization: modelPrep.status === 'ready' ? modelPrep.prepared.normalization : null,
              renderPlacedSceneChildren }}
            style={styles.navigator}
          />
        </Scene3DErrorBoundary>
      </View>

      {placement.status === 'placed' ? renderPlacedOverlay?.(placement) : null}

      {/* Thanh thao tác ổn định 1 tay & VoiceOver/TalkBack */}
      <View style={styles.controlsGrid}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thu nhỏ hiện vật AR"
          disabled={placement.status !== 'placed'}
          onPress={() => dispatch({ type: 'STEP_SCALE', delta: -0.15 })}
          style={[
            styles.smallBtn,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              opacity: placement.status === 'placed' ? 1 : 0.45,
            },
          ]}
        >
          <Text style={{ color: theme.colors.text, fontWeight: '700' }}>−</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Phóng to hiện vật AR"
          disabled={placement.status !== 'placed'}
          onPress={() => dispatch({ type: 'STEP_SCALE', delta: 0.15 })}
          style={[
            styles.smallBtn,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              opacity: placement.status === 'placed' ? 1 : 0.45,
            },
          ]}
        >
          <Text style={{ color: theme.colors.text, fontWeight: '700' }}>+</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xoay trái hiện vật AR"
          disabled={placement.status !== 'placed'}
          onPress={() => dispatch({ type: 'STEP_ROTATE', deltaDeg: -30 })}
          style={[
            styles.smallBtn,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              opacity: placement.status === 'placed' ? 1 : 0.45,
            },
          ]}
        >
          <Text style={{ color: theme.colors.text, fontWeight: '700' }}>↺</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xoay phải hiện vật AR"
          disabled={placement.status !== 'placed'}
          onPress={() => dispatch({ type: 'STEP_ROTATE', deltaDeg: 30 })}
          style={[
            styles.smallBtn,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              opacity: placement.status === 'placed' ? 1 : 0.45,
            },
          ]}
        >
          <Text style={{ color: theme.colors.text, fontWeight: '700' }}>↻</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đặt lại kích thước và góc xoay AR"
          disabled={placement.status !== 'placed'}
          onPress={() => dispatch({ type: 'RESET_TRANSFORM' })}
          style={[
            styles.wideBtn,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              opacity: placement.status === 'placed' ? 1 : 0.45,
            },
          ]}
        >
          <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.xs, fontWeight: '600' }}>
            Đặt lại
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn mặt phẳng đặt lại hiện vật"
          disabled={placement.status !== 'placed'}
          onPress={() => dispatch({ type: 'REPOSITION' })}
          style={[
            styles.wideBtn,
            {
              backgroundColor: theme.colors.primary,
              borderColor: theme.colors.primary,
              opacity: placement.status === 'placed' ? 1 : 0.45,
            },
          ]}
        >
          <Text style={{ color: theme.colors.primaryText, fontSize: theme.fontSize.xs, fontWeight: '600' }}>
            Đổi chỗ
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 10 },
  statusCard: { borderWidth: 1, gap: 4 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewport: { flex: 1, minHeight: 280, overflow: 'hidden', backgroundColor: '#0B0B0B' },
  navigator: { flex: 1 },
  fallbackCard: {
    flex: 1,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  btnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  btn: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsGrid: { flexDirection: 'row', gap: 6 },
  smallBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wideBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
});
