import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { useTheme } from '@/theme/ThemeProvider';
import { GalleryRoomView } from '@/features/scene3d/GalleryRoomView';
import { mapRoomDisplays } from '@/features/scene3d/gallerySlots';
import { usePublicRoom } from '@/features/scene3d/usePublicRoom';

export default function RoomDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { state, retry } = usePublicRoom(slug);
  const room = state.status === 'ready' ? state.room : null;
  const displays = useMemo(() => room ? mapRoomDisplays(room) : [], [room]);

  return (
    <Screen edges={['bottom']}>
      {state.status === 'loading' ? (
        <View accessibilityRole="progressbar" style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={{ color: theme.colors.text, textAlign: 'center' }}>Đang tải phòng trưng bày...</Text>
        </View>
      ) : state.status === 'error' ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: theme.spacing.lg, gap: theme.spacing.md }}>
          <Text accessibilityRole="alert" style={{ color: theme.colors.text }}>{state.message}</Text>
          <Pressable accessibilityRole="button" onPress={retry}>
            <Text style={{ color: theme.colors.primary }}>Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <GalleryRoomView
          roomName={state.room.name}
          displays={displays}
          onOpenAr={(exhibit) => router.push({
            pathname: '/ar-exhibit',
            params: { roomSlug: state.room.slug, exhibitId: exhibit.id },
          })}
        />
      )}
    </Screen>
  );
}
