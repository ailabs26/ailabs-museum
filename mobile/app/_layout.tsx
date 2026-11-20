import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@/theme/ThemeProvider';

/**
 * Root layout: providers toàn cục + Stack gốc (MOB-E1-03).
 * Nhóm (tabs) là màn chính; các màn như room/[slug] đẩy lên stack.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="room/[slug]" options={{ headerShown: true, title: 'Phòng' }} />
          <Stack.Screen
            name="spike-3d"
            options={{ headerShown: true, title: 'Spike 3D (MOB-E6-01)' }}
          />
          <Stack.Screen
            name="glb-preview"
            options={{ headerShown: true, title: 'GLB Cache Preview (MOB-E6-02)' }}
          />
          <Stack.Screen
            name="spike-ar"
            options={{ headerShown: true, title: 'Spike AR (MOB-E9-01)' }}
          />
          <Stack.Screen
            name="ar-exhibit"
            options={{ headerShown: true, title: 'AR Hiện vật & Hotspot (MOB-E9)' }}
          />
          <Stack.Screen name="+not-found" />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
