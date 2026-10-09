import { Button, Center, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <Center mih="100vh" p="md">
      <Stack align="center" gap="xs">
        <Title order={1}>404</Title>
        <Text c="dimmed">Không tìm thấy trang bạn yêu cầu.</Text>
        <Button component={Link} to="/" variant="light">
          Về trang chủ
        </Button>
      </Stack>
    </Center>
  );
}
