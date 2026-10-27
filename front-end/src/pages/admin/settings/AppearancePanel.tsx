import { Paper, SegmentedControl, Stack, Text, useMantineColorScheme, type MantineColorScheme } from '@mantine/core';

/** Giao diện sáng/tối/theo hệ thống; Mantine tự lưu lựa chọn vào localStorage (đồng bộ với nút trên header). */
export function AppearancePanel() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  return (
    <Paper withBorder p="lg" radius="md" maw={480}>
      <Stack gap="xs">
        <Text fw={600} id="color-scheme-label">Chế độ màu</Text>
        <SegmentedControl
          aria-labelledby="color-scheme-label"
          value={colorScheme}
          onChange={(value) => setColorScheme(value as MantineColorScheme)}
          data={[
            { value: 'light', label: 'Sáng' },
            { value: 'dark', label: 'Tối' },
            { value: 'auto', label: 'Theo hệ thống' },
          ]}
        />
        <Text size="xs" c="dimmed">Áp dụng cho trình duyệt này.</Text>
      </Stack>
    </Paper>
  );
}
