import { Tabs } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Thanh tab chính của app visitor (MOB-E1-03).
 * 4 tab: Trang chủ · Phòng · Tìm kiếm · Cài đặt.
 */
export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Trang chủ' }} />
      <Tabs.Screen name="rooms" options={{ title: 'Phòng' }} />
      <Tabs.Screen name="search" options={{ title: 'Tìm kiếm' }} />
      <Tabs.Screen name="settings" options={{ title: 'Cài đặt' }} />
    </Tabs>
  );
}
