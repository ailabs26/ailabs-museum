import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { ViroRuntimeComponents } from './arBridge';
import {
  computeArMarkerRadius,
  resolveArHotspotStory,
  type ArHotspotMarker,
} from './arHotspots';

export interface ArHotspotSceneMarkersProps {
  viro: ViroRuntimeComponents;
  hotspots: readonly ArHotspotMarker[];
  selectedHotspotId: string | null;
  arScale: number;
  onSelectHotspot: (hotspotId: string) => void;
}

/**
 * Các điểm đánh dấu hotspot 3D gắn trực tiếp lên hiện vật đã đặt trong không gian AR (MOB-E9-03).
 * Chạm vào bất kỳ hình cầu đánh dấu nào sẽ chọn điểm thuyết minh tương ứng.
 */
export function ArHotspotSceneMarkers({
  viro,
  hotspots,
  selectedHotspotId,
  arScale,
  onSelectHotspot,
}: ArHotspotSceneMarkersProps) {
  const { ViroNode, ViroSphere, ViroText } = viro;

  return (
    <ViroNode position={[0, 0, 0]}>
      {hotspots.map((marker) => {
        const isSelected = marker.id === selectedHotspotId;
        const radius = computeArMarkerRadius(arScale, isSelected);
        return (
          <ViroNode
            key={marker.id}
            position={marker.position}
            onClick={() => onSelectHotspot(marker.id)}
          >
            <ViroSphere
              testID={`ar-hotspot-marker-${marker.id}`}
              radius={radius}
              heightSegmentCount={12}
              widthSegmentCount={12}
              onClick={() => onSelectHotspot(marker.id)}
            />
            {isSelected ? (
              <ViroText
                text={marker.label}
                scale={[0.14, 0.14, 0.14]}
                position={[0, radius + 0.06, 0]}
              />
            ) : null}
          </ViroNode>
        );
      })}
    </ViroNode>
  );
}

export interface ArHotspotHudOverlayProps {
  hotspots: readonly ArHotspotMarker[];
  selectedHotspotId: string | null;
  onSelect: (hotspotId: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

/**
 * Lớp phủ HUD hotspot trên màn hình AR (MOB-E9-03):
 * - Thanh nút chọn nhanh mọi hotspot (hỗ trợ VoiceOver/TalkBack khi khó chạm cầu 3D).
 * - Thẻ thuyết minh chi tiết với tiến độ `Điểm k / N` và nút Trước / Tiếp / Đóng.
 */
export function ArHotspotHudOverlay({
  hotspots,
  selectedHotspotId,
  onSelect,
  onPrev,
  onNext,
  onClose,
}: ArHotspotHudOverlayProps) {
  const theme = useTheme();
  const activeStory = resolveArHotspotStory(hotspots, selectedHotspotId);

  if (hotspots.length === 0) return null;

  return (
    <View style={styles.wrapper} testID="ar-hotspot-hud">
      {activeStory ? (
        <View
          testID="ar-hotspot-story-card"
          accessibilityLiveRegion="polite"
          style={[
            styles.storyCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.primary,
              borderRadius: theme.radius.md,
              padding: theme.spacing.sm,
            },
          ]}
        >
          <View style={styles.storyHeader}>
            <Text
              testID="ar-hotspot-progress"
              style={{ color: theme.colors.primary, fontSize: theme.fontSize.xs, fontWeight: '700' }}
            >
              Điểm {activeStory.index + 1} / {activeStory.total}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng thẻ thuyết minh hotspot"
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.xs, fontWeight: '700' }}>
                Đóng ✕
              </Text>
            </Pressable>
          </View>
          <Text
            accessibilityRole="header"
            style={{ color: theme.colors.text, fontSize: theme.fontSize.md, fontWeight: '700' }}
          >
            {activeStory.hotspot.label}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
            {activeStory.hotspot.body}
          </Text>
          {activeStory.total > 1 ? (
            <View style={styles.storyNav}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Xem hotspot trước"
                disabled={!activeStory.hasPrev}
                onPress={onPrev}
                style={[
                  styles.navBtn,
                  {
                    borderColor: theme.colors.border,
                    opacity: activeStory.hasPrev ? 1 : 0.4,
                  },
                ]}
              >
                <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.xs, fontWeight: '600' }}>
                  ← Trước
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Xem hotspot tiếp theo"
                disabled={!activeStory.hasNext}
                onPress={onNext}
                style={[
                  styles.navBtn,
                  {
                    backgroundColor: theme.colors.primary,
                    borderColor: theme.colors.primary,
                    opacity: activeStory.hasNext ? 1 : 0.4,
                  },
                ]}
              >
                <Text style={{ color: theme.colors.primaryText, fontSize: theme.fontSize.xs, fontWeight: '600' }}>
                  Tiếp →
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {hotspots.map((marker, idx) => {
          const selected = marker.id === selectedHotspotId;
          return (
            <Pressable
              key={marker.id}
              testID={`ar-hotspot-chip-${marker.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Điểm ${idx + 1}: ${marker.label}`}
              onPress={() => onSelect(marker.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
                  borderColor: selected ? theme.colors.primary : theme.colors.border,
                  borderRadius: theme.radius.pill,
                },
              ]}
            >
              <Text
                style={{
                  color: selected ? theme.colors.primaryText : theme.colors.text,
                  fontSize: theme.fontSize.xs,
                  fontWeight: '600',
                }}
              >
                {idx + 1}. {marker.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  storyCard: { borderWidth: 1.5, gap: 6 },
  storyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    minHeight: 32,
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  storyNav: { flexDirection: 'row', gap: 8, marginTop: 4 },
  navBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsRow: { gap: 8, paddingVertical: 2 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
