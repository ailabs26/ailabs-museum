import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import {
  STORAGE_GROUPS,
  clearStorage,
  countCatalogue,
  formatBytes,
  getMediaUsage,
  type MediaUsage,
  type StorageGroup,
} from './storage-usage';

type Target = StorageGroup | 'all';

const LABELS: Record<Target, string> = {
  models: 'Mô hình 3D',
  audio: 'Thuyết minh âm thanh',
  images: 'Hình ảnh',
  catalogue: 'Nội dung xem offline',
  all: 'tất cả',
};

/** Mục "Bộ nhớ đệm" trong Cài đặt (MOB-E12-04): xem dung lượng, xóa từng loại hoặc tất cả (có xác nhận). */
export function StorageSettings() {
  const theme = useTheme();
  const client = useQueryClient();
  const [media, setMedia] = useState<MediaUsage | null>(null);
  // Theo dõi trực tiếp: cache khôi phục từ đĩa có thể xong sau khi màn này đã mở.
  const catalogue = useSyncExternalStore(
    useCallback((onChange) => client.getQueryCache().subscribe(onChange), [client]),
    () => countCatalogue(client),
  );
  const [confirming, setConfirming] = useState<Target | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setMedia(await getMediaUsage().catch(() => null));
  }, []);

  // Tab giữ nguyên khi chuyển màn: đo lại mỗi lần quay về.
  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => setConfirming(null);
    }, [refresh]),
  );

  const clear = async (target: Target) => {
    setBusy(true);
    setMessage(null);
    const groups = target === 'all' ? STORAGE_GROUPS : [target];
    // Một loại lỗi vẫn xóa tiếp các loại còn lại.
    const results = await Promise.allSettled(groups.map((group) => clearStorage(group, client)));
    const failed = groups.filter((_, i) => results[i]?.status === 'rejected').map((group) => LABELS[group]);
    await refresh();
    setMessage(failed.length ? `Không xóa được: ${failed.join(', ')}.` : `Đã xóa ${LABELS[target].toLowerCase()}.`);
    setConfirming(null);
    setBusy(false);
  };

  const detail: Record<StorageGroup, string> = {
    models: media ? formatBytes(media.models) : 'Không đo được',
    audio: media ? formatBytes(media.audio) : 'Không đo được',
    images: 'Không đo được',
    catalogue: `${catalogue} mục`,
  };

  const button = (label: string, a11yLabel: string, color: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={{ minHeight: 48, minWidth: 48, justifyContent: 'center', paddingHorizontal: theme.spacing.sm }}
    >
      <Text style={{ color, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold }}>{label}</Text>
    </Pressable>
  );

  const actions = (target: Target) =>
    confirming === target ? (
      <View style={{ flexDirection: 'row' }}>
        {button('Hủy', `Hủy xóa ${LABELS[target]}`, theme.colors.textMuted, () => setConfirming(null))}
        {button('Xác nhận', `Xác nhận xóa ${LABELS[target]}`, theme.colors.danger, () => void clear(target))}
      </View>
    ) : (
      button(target === 'all' ? 'Xóa tất cả' : 'Xóa', `Xóa ${LABELS[target]}`, theme.colors.danger, () => setConfirming(target))
    );

  return (
    <View>
      <Text
        accessibilityRole="header"
        style={{ color: theme.colors.text, fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.bold }}
      >
        Bộ nhớ đệm
      </Text>
      {STORAGE_GROUPS.map((group) => (
        <View key={group} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.sm }}>{LABELS[group]}</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.xs }}>{detail[group]}</Text>
          </View>
          {actions(group)}
        </View>
      ))}
      {actions('all')}
      {message ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: theme.colors.text, fontSize: theme.fontSize.sm }}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}
