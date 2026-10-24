import { ActionIcon, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { IconMoonStars, IconSun } from '@tabler/icons-react';

/**
 * Bộ chuyển đổi Dark / Light mode với icon Mặt trời / Mặt trăng.
 * Dùng useComputedColorScheme để phân giải chế độ 'auto' về giá trị thực.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const isDark = computed === 'dark';

  return (
    <ActionIcon
      className={className}
      variant="default"
      size="lg"
      radius="xl"
      aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
    >
      {isDark
        ? <IconSun size={18} stroke={1.6} aria-hidden="true" />
        : <IconMoonStars size={18} stroke={1.6} aria-hidden="true" />}
    </ActionIcon>
  );
}
