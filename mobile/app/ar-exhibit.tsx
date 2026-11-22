import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { useTheme } from '@/theme/ThemeProvider';
import { ArExhibitExperienceView } from '@/features/ar/ArExhibitExperienceView';
import { mapRoomDisplays } from '@/features/scene3d/gallerySlots';
import { usePublicRoom } from '@/features/scene3d/usePublicRoom';

export default function ArExhibitScreen() {
  const { roomSlug, exhibitId } = useLocalSearchParams<{ roomSlug: string; exhibitId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { state, retry } = usePublicRoom(roomSlug);
  const room = state.status === 'ready' ? state.room : null;
  const exhibit = useMemo(() => room && exhibitId
    ? mapRoomDisplays(room).find((item) => item.id === exhibitId) ?? null
    : null, [room, exhibitId]);

  return (
    <Screen edges={['bottom']}>
      {state.status === 'loading' ? (
        <View accessibilityRole="progressbar" style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={{ color: theme.colors.text, textAlign: 'center' }}>Đang tải hiện vật AR...</Text>
        </View>
      ) : state.status === 'error' || !exhibit ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: theme.spacing.lg, gap: theme.spacing.md }}>
          <Text accessibilityRole="alert" style={{ color: theme.colors.text }}>
            {state.status === 'error' ? state.message : 'Không tìm thấy hiện vật đã xuất bản trong phòng này.'}
          </Text>
          <Pressable accessibilityRole="button" onPress={retry}>
            <Text style={{ color: theme.colors.primary }}>Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <ArExhibitExperienceView
          exhibit={exhibit}
          onFallback3D={() => router.replace({ pathname: '/room/[slug]', params: { slug: roomSlug } })}
          onExit={() => router.back()}
        />
      )}
    </Screen>
  );
}
