import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { isFeatureEnabled } from '@/config/env';
import { fileCache } from '@/core/cache/file-cache';
import { useIsOnline } from '@/core/network/online-status';
import { roomKeys } from '@/features/catalogue/room-queries';
import type { PublicRoomPayload } from '@/features/scene3d/museumTypes';
import { useTheme } from '@/theme/ThemeProvider';
import { OFFLINE_STATUS_KEY, isRoomAvailableOffline, prefetchRoom, roomModels } from './room-prefetch';

interface Props {
  slug: string;
  name: string;
}

/** Nút "Tải để xem offline" của một phòng (MOB-E12-02). Ẩn khi tắt flag hoặc không có file system (web). */
export function OfflineRoomButton(props: Props) {
  if (!isFeatureEnabled('offlinePrefetch') || !fileCache.enabled) return null;
  return <OfflineRoomControl {...props} />;
}

export function OfflineRoomControl({ slug, name }: Props) {
  const theme = useTheme();
  const client = useQueryClient();
  const online = useIsOnline();
  const running = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Chỉ theo dõi nội dung đã có trong cache, không tự tải.
  const { data: room } = useQuery<PublicRoomPayload>({ queryKey: roomKeys.detail(slug), enabled: false });
  // Kiểm file thật trên máy thay vì lưu cờ "đã tải": LRU hoặc hệ điều hành có thể đã dọn.
  const { data: available = false } = useQuery({
    queryKey: [...OFFLINE_STATUS_KEY, slug, room ? roomModels(room).map((m) => m.checksumSha256) : null],
    queryFn: () => (room ? isRoomAvailableOffline(room) : false),
    enabled: Boolean(room),
    networkMode: 'always',
    staleTime: 0,
    gcTime: 0,
    meta: { persist: false },
  });

  useEffect(() => () => running.current?.abort(), []);

  const start = async () => {
    const controller = new AbortController();
    running.current = controller;
    setError(null);
    setProgress({ done: 0, total: 0 });
    try {
      const result = await prefetchRoom(client, slug, controller.signal, (done, total) => {
        if (!controller.signal.aborted) setProgress({ done, total });
      });
      if (result.failed) setError(`Thiếu ${result.failed}/${result.total} mô hình. ${result.message ?? ''}`.trim());
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không tải được phòng.');
    } finally {
      // Tải phòng này có thể đẩy model của phòng khác ra khỏi cache.
      void client.invalidateQueries({ queryKey: OFFLINE_STATUS_KEY });
      if (running.current === controller) {
        running.current = null;
        setProgress(null);
      }
    }
  };
  const cancel = () => {
    running.current?.abort();
    running.current = null;
    setProgress(null);
  };

  const text = { fontSize: theme.fontSize.sm };
  return (
    <View>
      {progress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Hủy tải ${name}`} onPress={cancel} style={{ minHeight: 48, justifyContent: 'center' }}>
          <Text accessibilityLiveRegion="polite" style={[text, { color: theme.colors.textMuted }]}>
            {progress.total ? `Đang tải ${progress.done}/${progress.total} mô hình — Hủy` : 'Đang tải… — Hủy'}
          </Text>
        </Pressable>
      ) : available ? (
        <Text style={[text, { color: theme.colors.textMuted }]}>Đã tải để xem offline</Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Tải ${name} để xem offline`}
          accessibilityState={{ disabled: !online }}
          disabled={!online}
          onPress={() => void start()}
          style={{ minHeight: 48, justifyContent: 'center', opacity: online ? 1 : 0.5 }}
        >
          <Text style={[text, { color: theme.colors.primary }]}>Tải để xem offline</Text>
        </Pressable>
      )}
      {error ? <Text accessibilityRole="alert" style={[text, { color: theme.colors.danger }]}>{error}</Text> : null}
    </View>
  );
}
