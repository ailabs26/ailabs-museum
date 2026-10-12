import { Badge, Card, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import { EmptyState } from '@/shared/components/data/EmptyState';

export function MuseumCatalogue({ displays }: { displays: readonly MuseumDisplay[] }) {
  return (
    <section aria-labelledby="catalogue-title" id="museum-catalogue" tabIndex={-1}>
      <Stack gap="md">
        <Title order={2} id="catalogue-title">Trong phòng trưng bày</Title>
        <Text c="dimmed">Chưa có model hoặc ảnh từ API; đang hiển thị hình khối thay thế.</Text>
        {displays.length === 0 && <EmptyState text="Phòng này chưa có hiện vật được xuất bản." />}
        <SimpleGrid component="ul" aria-label="Các hiện vật" cols={{ base: 1, sm: 2, lg: 5 }} p={0} m={0} style={{ listStyle: 'none' }}>
          {displays.map((display, index) => (
            <Card component="li" key={display.id} withBorder padding="lg">
              <Badge variant="light" color="gray" mb="md">Hiện vật {String(index + 1).padStart(2, '0')}</Badge>
              <Title order={3} size="h4" mb="xs">{display.title}</Title>
              <Text size="sm" c="dimmed">{display.description}</Text>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>
    </section>
  );
}
