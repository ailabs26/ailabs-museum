import { Container, Stack, Text, Title } from '@mantine/core';

export function MuseumPage() {
  return (
    <Container size="xl" py="xl">
      <Stack>
        <Text size="xs" tt="uppercase" c="dimmed" fw={700}>Aura / Phòng nghiên cứu 01</Text>
        <Title order={1}>Không gian của hình khối</Title>
        <Text>Phòng trưng bày mẫu — khám phá nhịp điệu, chất liệu và ánh sáng.</Text>
      </Stack>
    </Container>
  );
}
