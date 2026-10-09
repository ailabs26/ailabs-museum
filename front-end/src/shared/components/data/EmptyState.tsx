import { IconInbox } from '@tabler/icons-react';
import { Center, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';

export function EmptyState({ text = 'Chưa có dữ liệu', action }: { text?: string; action?: ReactNode }) {
  return (
    <Center py="xl">
      <Stack align="center" gap="xs">
        <IconInbox size={40} stroke={1.3} opacity={0.5} />
        <Text c="dimmed" size="sm">
          {text}
        </Text>
        {action}
      </Stack>
    </Center>
  );
}
