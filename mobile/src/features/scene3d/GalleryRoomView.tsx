import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { PixelRatio, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import { useTheme } from '@/theme/ThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Scene3DErrorBoundary } from './Scene3DErrorBoundary';
import { FpsMeter, type FpsSnapshot } from './fpsMeter';
import { configureExpoGlContext } from './glbLoader';
import { GalleryRoomDisplays3D, MuseumRoomShell3D } from './GalleryRoomComponents';
import { resolveGalleryLayout } from './gallerySlots';
import { pickGalleryTarget, type GalleryPickTarget } from './galleryPicking';
import { resolveHotspotStory, type HotspotStorySelection, type SelectHotspot } from './hotspotStory';
import type { MuseumDisplay } from './museumTypes';
import { useSceneQuality } from './useSceneQuality';
import {
  INITIAL_CAMERA_POSITION,
  INITIAL_CAMERA_TARGET,
  NavigationGestures,
  createNavigationInput,
  type CameraAction,
} from './museumNavigation';
import {
  TouchCameraController,
  type FocusExhibitRequest,
} from './TouchCameraController';
import { getGalleryColliders, moveWithCollisions } from './museumCollision';
import { TouchNavigationHud } from './TouchNavigationHud';
import {
  RoomModelManager,
  type RoomModelManagerOptions,
  type RoomModelState,
} from './roomModelManager';

export interface GalleryRoomViewProps {
  roomId?: string;
  roomName: string;
  displays: readonly MuseumDisplay[];
  managerOptions?: RoomModelManagerOptions;
  /** Cho phép mở thẳng danh sách 2D (accessibility fallback). */
  initialMode?: '3d' | '2d';
  onSelectExhibit?: (exhibit: MuseumDisplay) => void;
  /** Phát khi visitor chọn một hotspot authored hợp lệ. */
  onHotspotSelected?: (selection: HotspotStorySelection) => void;
  onOpenAr?: (exhibit: MuseumDisplay) => void;
}

const EMPTY_MODEL_STATES: ReadonlyMap<string, RoomModelState> = new Map();

function AdaptiveFpsMonitor({
  dprCap,
  onSample,
}: {
  dprCap: number;
  onSample: (snapshot: FpsSnapshot) => void;
}) {
  const { gl } = useThree();
  const meterRef = useRef<FpsMeter>(new FpsMeter({ windowSize: 60, maxGapMs: 500 }));
  const elapsedRef = useRef(0);

  useEffect(() => {
    if (typeof gl?.setPixelRatio === 'function') {
      gl.setPixelRatio(Math.min(PixelRatio.get(), dprCap));
    }
  }, [gl, dprCap]);

  useFrame((_state, deltaSec) => {
    const ms = deltaSec * 1000;
    meterRef.current.recordDelta(ms);
    elapsedRef.current += ms;
    if (elapsedRef.current >= 1000) {
      elapsedRef.current = 0;
      onSample(meterRef.current.getSnapshot());
    }
  });
  return null;
}

type PickAt = (x: number, y: number) => GalleryPickTarget | undefined;

function GalleryTouchPicker({ pickAt }: { pickAt: MutableRefObject<PickAt | null> }) {
  const { camera, scene, size } = useThree();
  useLayoutEffect(() => {
    pickAt.current = (x, y) => pickGalleryTarget(scene, camera, size, x, y);
    return () => {
      pickAt.current = null;
    };
  }, [camera, scene, size, pickAt]);
  return null;
}

/**
 * Màn hình tham quan phòng 3D với nhiều hiện vật đặt đúng theo Gallery Slots (MOB-E6-04),
 * điều khiển cảm ứng + va chạm (MOB-E6-05/06) và tự điều chỉnh chất lượng theo thiết bị (MOB-E6-08).
 */
export function GalleryRoomView({
  roomId,
  roomName,
  displays,
  managerOptions,
  initialMode = '3d',
  onSelectExhibit,
  onHotspotSelected,
  onOpenAr,
}: GalleryRoomViewProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const quality = useSceneQuality(reducedMotion);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>(initialMode);
  const [selectedId, setSelectedId] = useState<string | null>(displays[0]?.id ?? null);
  const [hotspotSelection, setHotspotSelection] = useState<HotspotStorySelection | null>(null);
  const [modelSnapshot, setModelSnapshot] = useState<{
    displays: readonly MuseumDisplay[];
    states: ReadonlyMap<string, RoomModelState>;
  }>();
  // A refetch can render a new revision before its model manager effect starts.
  const modelStates =
    modelSnapshot?.displays === displays ? modelSnapshot.states : EMPTY_MODEL_STATES;

  useEffect(() => {
    setSelectedId((current) => displays.some((item) => item.id === current)
      ? current : displays[0]?.id ?? null);
  }, [displays]);

  const navInput = useMemo(() => createNavigationInput(), []);
  const navGestures = useMemo(() => new NavigationGestures(), []);
  const commandHandlerRef = useRef<((action: CameraAction) => void) | null>(null);
  const pickAt = useRef<PickAt | null>(null);

  const handleCameraAction = useCallback((action: CameraAction) => {
    commandHandlerRef.current?.(action);
  }, []);

  const layout = useMemo(() => resolveGalleryLayout(displays), [displays]);
  const colliders = useMemo(() => getGalleryColliders(displays), [displays]);
  const [focusRequest, setFocusRequest] = useState<FocusExhibitRequest | null>(null);
  const selectedDisplay = useMemo(
    () => displays.find((item) => item.id === selectedId) ?? null,
    [displays, selectedId],
  );
  const activeHotspotSelection =
    hotspotSelection?.roomId === roomId &&
    resolveHotspotStory(hotspotSelection, selectedDisplay ?? undefined)
      ? hotspotSelection
      : null;

  useEffect(() => {
    if (hotspotSelection && !activeHotspotSelection) {
      setHotspotSelection((current) => current === hotspotSelection ? null : current);
    }
  }, [hotspotSelection, activeHotspotSelection]);

  useEffect(() => {
    const manager = new RoomModelManager({
      maxConcurrent: quality.profile.maxConcurrentGlbLoads,
      ...managerOptions,
    });
    void manager.loadRoomDisplays(displays, (nextStates) => {
      setModelSnapshot({ displays, states: nextStates });
    });
    return () => {
      manager.dispose();
    };
  }, [displays, managerOptions, quality.profile.maxConcurrentGlbLoads]);

  const commitSelection = (display: MuseumDisplay, hotspot: HotspotStorySelection | null) => {
    setSelectedId(display.id);
    setHotspotSelection(hotspot);
    onSelectExhibit?.(display);
    if (hotspot) onHotspotSelected?.(hotspot);
  };

  const handleSelectById = (exhibitId: string) => {
    const display = displays.find((item) => item.id === exhibitId);
    if (display) commitSelection(display, null);
  };

  const handleSelectHotspot: SelectHotspot = (exhibitId, hotspotId) => {
    const display = displays.find((item) => item.id === exhibitId);
    if (!roomId || !display) return;
    const selection = { roomId, exhibitId, hotspotId, issuedAt: Date.now() };
    if (resolveHotspotStory(selection, display)) commitSelection(display, selection);
  };

  const handleViewportTap = (x: number, y: number) => {
    const target = pickAt.current?.(x, y);
    if (!target) return;
    if (target.hotspotId === undefined) handleSelectById(target.exhibitId);
    else handleSelectHotspot(target.exhibitId, target.hotspotId);
  };

  const layoutLabel =
    layout.mode === 'slotted'
      ? `Bố cục chuẩn 5 bục (${displays.length}/5 hiện vật)`
      : `Bố cục tự do (${displays.length} hiện vật · ${layout.reason})`;

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            padding: theme.spacing.sm,
          },
        ]}
      >
        <View style={styles.headerText}>
          <Text
            accessibilityRole="header"
            style={[styles.roomTitle, { color: theme.colors.text, fontSize: theme.fontSize.md }]}
          >
            {roomName}
          </Text>
          <Text
            testID="gallery-layout-badge"
            style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.xs }}
          >
            {layoutLabel}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            testID="gallery-quality-toggle"
            accessibilityRole="button"
            accessibilityLabel={`Đổi chất lượng 3D, hiện tại ${quality.profile.label}`}
            onPress={quality.cycleMode}
            style={[
              styles.qualityPill,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.background,
                borderRadius: theme.radius.md,
              },
            ]}
          >
            <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.xs, fontWeight: '600' }}>
              {quality.mode === 'auto' ? `Auto: ${quality.profile.tier}` : quality.profile.label}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              viewMode === '3d' ? 'Chuyển sang danh sách hiện vật 2D' : 'Quay lại phòng trưng bày 3D'
            }
            onPress={() => setViewMode((prev) => (prev === '3d' ? '2d' : '3d'))}
            style={[
              styles.modeToggle,
              { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md },
            ]}
          >
            <Text style={{ color: theme.colors.primaryText, fontSize: theme.fontSize.xs, fontWeight: '600' }}>
              {viewMode === '3d' ? 'Danh sách 2D' : 'Xem 3D'}
            </Text>
          </Pressable>
        </View>
      </View>

      {viewMode === '3d' ? (
        <View style={[styles.viewport, { borderRadius: theme.radius.lg }]} testID="gallery-3d-viewport">
          <Scene3DErrorBoundary onFallback2D={() => setViewMode('2d')}>
            <Canvas
              pointerEvents="none"
              camera={{ position: INITIAL_CAMERA_POSITION, fov: 60 }}
              shadows={quality.profile.enableShadows}
              gl={{ antialias: quality.profile.antialias }}
              onCreated={(state) => {
                configureExpoGlContext(state.gl.getContext());
                state.gl.setPixelRatio(Math.min(PixelRatio.get(), quality.profile.dprCap));
                state.camera.lookAt(...INITIAL_CAMERA_TARGET);
              }}
            >
              <AdaptiveFpsMonitor
                dprCap={quality.profile.dprCap}
                onSample={quality.reportFpsSample}
              />
              <MuseumRoomShell3D quality={quality.profile} />
              <GalleryTouchPicker pickAt={pickAt} />
              <TouchCameraController
                input={navInput}
                commandHandler={commandHandlerRef}
                reducedMotion={reducedMotion}
                colliders={colliders}
                moveHandler={moveWithCollisions}
                focusRequest={focusRequest}
              />
              <GalleryRoomDisplays3D
                displays={displays}
                modelStates={modelStates}
                selectedExhibitId={selectedId}
                activeHotspotSelection={activeHotspotSelection}
                quality={quality.profile}
              />
            </Canvas>
            <TouchNavigationHud
              input={navInput}
              gestures={navGestures}
              onAction={handleCameraAction}
              onTap={handleViewportTap}
            />
          </Scene3DErrorBoundary>
        </View>
      ) : (
        <ScrollView
          testID="gallery-2d-list"
          style={styles.listScroll}
          contentContainerStyle={styles.listContent}
        >
          {displays.map((item) => {
            const state = modelStates.get(item.id);
            const active = item.id === selectedId;
            const hotspots = roomId && item.roomId === roomId ? item.hotspots : undefined;
            return (
              <View key={item.id} style={styles.listItem}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => handleSelectById(item.id)}
                  style={[
                    styles.listCard,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: active ? theme.colors.primary : theme.colors.border,
                      borderRadius: theme.radius.md,
                      padding: theme.spacing.md,
                    },
                  ]}
                >
                  <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.md, fontWeight: '700' }}>
                    {item.title}
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
                    {item.description}
                  </Text>
                  <Text style={{ color: theme.colors.primary, fontSize: theme.fontSize.xs }}>
                    Tọa độ: ({item.position[0]}, {item.position[1]}, {item.position[2]}) m
                    {state ? ` · GLB: ${state.status}` : ' · Hình khối mẫu'}
                  </Text>
                </Pressable>
                {hotspots?.map((hotspot) => {
                  const selected = active && activeHotspotSelection?.hotspotId === hotspot.id;
                  const label = hotspot.label || item.title;
                  return (
                    <Pressable
                      key={hotspot.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Điểm tương tác ${item.title}, ${label}`}
                      accessibilityState={{ selected }}
                      onPress={() => handleSelectHotspot(item.id, hotspot.id)}
                      style={[
                        styles.hotspotButton,
                        {
                          backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
                          borderColor: selected ? theme.colors.primary : theme.colors.border,
                          borderRadius: theme.radius.md,
                          paddingHorizontal: theme.spacing.md,
                        },
                      ]}
                    >
                      <Text style={{ color: selected ? theme.colors.primaryText : theme.colors.text }}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}

      {selectedDisplay ? (
        <View
          testID="gallery-selected-card"
          style={[
            styles.selectedCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
              padding: theme.spacing.sm,
            },
          ]}
        >
          <View style={styles.selectedHeaderRow}>
            <Text
              style={{
                flex: 1,
                color: theme.colors.text,
                fontSize: theme.fontSize.sm,
                fontWeight: '700',
              }}
            >
              Đang chọn: {selectedDisplay.title}
            </Text>
            {onOpenAr ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Xem ${selectedDisplay.title} trong AR`}
                onPress={() => onOpenAr(selectedDisplay)}
                style={[styles.focusBtn, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm }]}
              >
                <Text style={{ color: theme.colors.primaryText, fontSize: theme.fontSize.xs, fontWeight: '600' }}>
                  Xem AR
                </Text>
              </Pressable>
            ) : null}
            {viewMode === '3d' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Di chuyển camera tới gần ${selectedDisplay.title}`}
                onPress={() =>
                  setFocusRequest({
                    exhibit: selectedDisplay,
                    displays,
                    issuedAt: Date.now(),
                  })
                }
                style={[
                  styles.focusBtn,
                  { backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm },
                ]}
              >
                <Text
                  style={{
                    color: theme.colors.primaryText,
                    fontSize: theme.fontSize.xs,
                    fontWeight: '600',
                  }}
                >
                  Đến gần
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Text
            numberOfLines={2}
            style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.xs }}
          >
            {selectedDisplay.description}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 10 },
  headerBar: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerText: { flex: 1, gap: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qualityPill: {
    minHeight: 40,
    paddingHorizontal: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomTitle: { fontWeight: '700' },
  modeToggle: {
    minHeight: 40,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewport: {
    flex: 1,
    minHeight: 300,
    overflow: 'hidden',
    backgroundColor: '#14181D',
  },
  listScroll: { flex: 1 },
  listContent: { gap: 10, paddingBottom: 12 },
  listItem: { gap: 6 },
  listCard: { borderWidth: 1.5, gap: 4 },
  hotspotButton: { borderWidth: 1, justifyContent: 'center', minHeight: 44 },
  selectedCard: { borderWidth: 1, gap: 4 },
  selectedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  focusBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 32,
    justifyContent: 'center',
  },
});
