import { Button, Group, Progress, Stack, Text } from '@mantine/core';
import type { ModelSnapshot } from '@/helpers/roomModelAssets';
import type { MuseumDisplay } from '@/interfaces/museumScene';

export function ModelLoadingStatus({ displays, models, onRetry }: {
  displays: readonly MuseumDisplay[]; models: ModelSnapshot; onRetry: (checksum: string) => void;
}) {
  const available = displays.filter(display => display.model && !display.isOutsideRoom);
  if (!available.length) return null;
  const ready = available.filter(display => models[display.model!.checksumSha256]?.status === 'ready').length;
  const progress = available.reduce((sum, display) => {
    const state = models[display.model!.checksumSha256];
    return sum + (state?.status === 'ready' ? 1 : state?.status === 'loading' ? (state.progress ?? 0) * 0.9 : 0);
  }, 0) / available.length * 100;
  return <Stack gap="xs" py="sm" aria-label="Trạng thái mô hình 3D">
    <Text role="status" size="sm">Đã tải {ready}/{available.length} mô hình 3D</Text>
    {ready < available.length && <Progress value={progress} aria-label="Tiến độ tải mô hình" />}
    {available.map(display => models[display.model!.checksumSha256]?.status === 'error' &&
      <Group key={display.id} gap="sm"><Text size="sm" c="red.8">Không tải được mô hình: {display.title}.</Text>
        <Button size="xs" variant="light" onClick={() => onRetry(display.model!.checksumSha256)}>Thử lại {display.title}</Button></Group>)}
  </Stack>;
}
