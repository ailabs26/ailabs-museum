import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas } from '@react-three/fiber/native';
import { useTheme } from '@/theme/ThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Scene3DErrorBoundary } from './Scene3DErrorBoundary';
import { configureExpoGlContext } from './glbLoader';
import { GalleryRoomDisplays3D, MuseumRoomShell3D } from './GalleryRoomComponents';
import { resolveGalleryLayout } from './gallerySlots';
import type { MuseumDisplay } from './museumTypes';
import {
  INITIAL_CAMERA_POSITION,
  INITIAL_CAMERA_TARGET,
  NavigationGestures,
  createNavigationInput,
  type CameraAction,
} from './museumNavigation';
import { TouchCameraController } from './TouchCameraController';
import { TouchNavigationHud } from './TouchNavigationHud';
import {
  RoomModelManager,
  type RoomModelManagerOptions,
  type RoomModelState,
} from './roomModelManager';

export interface GalleryRoomViewProps {
  roomName: string;
  displays: readonly MuseumDisplay[];
  managerOptions?: RoomModelManagerOptions;
  /** Cho phép mở thẳng danh sách 2D (accessibility fallback). */
  initialMode?: '3d' | '2d';
  onSelectExhibit?: (exhibit: MuseumDisplay) => void;
}

/**
 * Màn hình tham quan phòng 3D với nhiều hiện vật đặt đúng theo Gallery Slots (MOB-E6-04).
 * Luôn đi kèm chế độ 2D song song để đảm bảo khả năng tiếp cận và dự phòng khi GL lỗi.
 */
export function GalleryRoomView({
  roomName,
  displays,
  managerOptions,
  initialMode = '3d',
  onSelectExhibit,
}: GalleryRoomViewProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [viewMode, setViewMode] = useState<'3d' | '2d'>(initialMode);
  const [selectedId, setSelectedId] = useState<string | null>(displays[0]?.id ?? null);
  const [modelStates, setModelStates] = useState<ReadonlyMap<string, RoomModelState>>(
    () => new Map(),
  );

  const navInput = useMemo(() => createNavigationInput(), []);
  const navGestures = useMemo(() => new NavigationGestures(), []);
  const commandHandlerRef = useRef<((action: CameraAction) => void) | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') navInput.stop();
    });
    return () => subscription.remove();
  }, [navInput]);

  const handleCameraAction = useCallback((action: CameraAction) => {
    commandHandlerRef.current?.(action);
  }, []);

  const layout = useMemo(() => resolveGalleryLayout(displays), [displays]);
  const selectedDisplay = useMemo(
    () => displays.find((item) => item.id === selectedId) ?? null,
    [displays, selectedId],
  );

  useEffect(() => {
    const manager = new RoomModelManager(managerOptions);
    void manager.loadRoomDisplays(displays, (nextStates) => {
      setModelStates(nextStates);
    });
    return () => {
      manager.dispose();
    };
  }, [displays, managerOptions]);

  const handleSelectById = (exhibitId: string) => {
    setSelectedId(exhibitId);
    const found = displays.find((item) => item.id === exhibitId);
    if (found) onSelectExhibit?.(found);
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

      {viewMode === '3d' ? (
        <View style={[styles.viewport, { borderRadius: theme.radius.lg }]} testID="gallery-3d-viewport">
          <Scene3DErrorBoundary onFallback2D={() => setViewMode('2d')}>
            <Canvas
              camera={{ position: INITIAL_CAMERA_POSITION, fov: 60 }}
              gl={{ antialias: true }}
              onCreated={(state) => {
                configureExpoGlContext(state.gl.getContext());
                state.camera.lookAt(...INITIAL_CAMERA_TARGET);
              }}
            >
              <MuseumRoomShell3D />
              <TouchCameraController
                input={navInput}
                commandHandler={commandHandlerRef}
                reducedMotion={reducedMotion}
              />
              <GalleryRoomDisplays3D
                displays={displays}
                modelStates={modelStates}
                selectedExhibitId={selectedId}
                onSelectExhibit={(id) => {
                  if (navGestures.canSelect) handleSelectById(id);
                }}
              />
            </Canvas>
            <TouchNavigationHud
              input={navInput}
              gestures={navGestures}
              onAction={handleCameraAction}
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
            return (
              <Pressable
                key={item.id}
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
          <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: '700' }}>
            Đang chọn: {selectedDisplay.title}
          </Text>
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
  listCard: { borderWidth: 1.5, gap: 4 },
  selectedCard: { borderWidth: 1, gap: 4 },
});
