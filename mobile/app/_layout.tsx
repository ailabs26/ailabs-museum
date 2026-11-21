import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryProvider } from '@/core/query/QueryProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';

/**
 * Root layout: providers toàn cục + Stack gốc (MOB-E1-03).
 * Nhóm (tabs) là màn chính; các màn như room/[slug] đẩy lên stack.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryProvider>
        <ThemeProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="room/[slug]" options={{ headerShown: true, title: 'Phòng' }} />
            <Stack.Screen name="+not-found" />
          </Stack>
        </ThemeProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
