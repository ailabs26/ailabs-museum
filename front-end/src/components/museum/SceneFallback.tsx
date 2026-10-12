import { Anchor, Stack, Text, Title } from '@mantine/core';
import { useEffect, useRef } from 'react';

export function SceneFallback() {
  const messageRef = useRef<HTMLDivElement>(null);
  useEffect(() => messageRef.current?.focus({ preventScroll: true }), []);
  return (
    <Stack ref={messageRef} tabIndex={-1} align="center" justify="center" h="100%" p="xl" ta="center" role="status">
      <Title order={2} size="h3">Không thể mở không gian 3D</Title>
      <Text>Thiết bị có thể không hỗ trợ WebGL hoặc phần hiển thị chưa tải được.</Text>
      <Anchor href="#museum-catalogue">Đọc nội dung phòng trưng bày</Anchor>
    </Stack>
  );
}
