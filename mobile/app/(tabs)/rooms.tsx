import { useEffect, useState } from 'react';
import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { useTheme } from '@/theme/ThemeProvider';
import { publicRoomApi, type PublicRoomSummary } from '@/features/scene3d/publicRoomApi';

export default function RoomsScreen() {
  const theme = useTheme();
  const [rooms, setRooms] = useState<PublicRoomSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    publicRoomApi.list(controller.signal)
      .then((result) => { if (!controller.signal.aborted) setRooms(result); })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không tải được danh sách phòng.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: theme.spacing.md, padding: theme.spacing.md }}>
        <Text accessibilityRole="header" style={{ color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '700' }}>
          Danh sách phòng
        </Text>
        {loading ? <ActivityIndicator accessibilityLabel="Đang tải danh sách phòng" color={theme.colors.primary} /> : null}
        {error ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)}>
              <Text style={{ color: theme.colors.primary }}>Thử lại</Text>
            </Pressable>
          </View>
        ) : null}
        {!loading && !error && rooms.length === 0 ? (
          <Text style={{ color: theme.colors.textMuted }}>Chưa có phòng trưng bày công khai.</Text>
        ) : null}
        {!loading && !error ? rooms.map((room) => (
          <Link key={room.id} href={{ pathname: '/room/[slug]', params: { slug: room.slug } }}
            accessibilityRole="link" style={{ color: theme.colors.primary, fontSize: theme.fontSize.md }}>
            {room.name}
          </Link>
        )) : null}
      </ScrollView>
    </Screen>
  );
}
