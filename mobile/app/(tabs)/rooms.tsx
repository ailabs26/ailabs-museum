import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { useTheme } from '@/theme/ThemeProvider';
import { OfflineRoomButton } from '@/features/offline/OfflineRoomButton';
import {
  OFFLINE_NOT_CACHED_MESSAGE,
  isWaitingForNetwork,
  useRoomsQuery,
} from '@/features/catalogue/room-queries';

export default function RoomsScreen() {
  const theme = useTheme();
  // Qua react-query: danh sách đã tải được lưu cache và vẫn hiện khi mất mạng (MOB-E12-01).
  const query = useRoomsQuery();
  const rooms = query.data ?? [];
  const loading = query.data === undefined && query.isFetching;
  const error =
    query.data || loading
      ? null
      : isWaitingForNetwork(query)
        ? OFFLINE_NOT_CACHED_MESSAGE
        : query.isError
          ? query.error.message || 'Không tải được danh sách phòng.'
          : null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: theme.spacing.md, padding: theme.spacing.md }}>
        <Text
          accessibilityRole="header"
          style={{ color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '700' }}
        >
          Danh sách phòng
        </Text>
        {loading ? (
          <ActivityIndicator
            accessibilityLabel="Đang tải danh sách phòng"
            color={theme.colors.primary}
          />
        ) : null}
        {error ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>
              {error}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => void query.refetch()}>
              <Text style={{ color: theme.colors.primary }}>Thử lại</Text>
            </Pressable>
          </View>
        ) : null}
        {!loading && !error && rooms.length === 0 ? (
          <Text style={{ color: theme.colors.textMuted }}>Chưa có phòng trưng bày công khai.</Text>
        ) : null}
        {!loading && !error
          ? rooms.map((room) => (
              <View key={room.id}>
                <Link
                  href={{ pathname: '/room/[slug]', params: { slug: room.slug } }}
                  accessibilityRole="link"
                  style={{ color: theme.colors.primary, fontSize: theme.fontSize.md }}
                >
                  {room.name}
                </Link>
                <OfflineRoomButton slug={room.slug} name={room.name} />
              </View>
            ))
          : null}
      </ScrollView>
    </Screen>
  );
}
