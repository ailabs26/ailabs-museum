import { Anchor, Stack, Text, Title } from '@mantine/core';

export function SceneFallback() {
  return (
    <Stack align="center" justify="center" h="100%" p="xl" ta="center" role="status">
      <Title order={2} size="h3">Không thể mở không gian 3D</Title>
      <Text>Thiết bị có thể không hỗ trợ WebGL hoặc phần hiển thị chưa tải được.</Text>
      <Anchor href="#museum-catalogue">Đọc nội dung phòng trưng bày</Anchor>
    </Stack>
  );
}
