import { Container, Stack, Text, Title } from '@mantine/core';
import { MuseumCatalogue } from '@/components/museum/MuseumCatalogue';
import { SAMPLE_DISPLAYS } from '@/components/museum/sampleDisplays';

export function MuseumPage() {
  return (
    <Container size="xl" py="xl">
      <Stack>
        <Text size="xs" tt="uppercase" c="dimmed" fw={700}>Aura / Phòng nghiên cứu 01</Text>
        <Title order={1}>Không gian của hình khối</Title>
        <Text>Phòng trưng bày mẫu — khám phá nhịp điệu, chất liệu và ánh sáng.</Text>
        <MuseumCatalogue displays={SAMPLE_DISPLAYS} />
      </Stack>
    </Container>
  );
}
