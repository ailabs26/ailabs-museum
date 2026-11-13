import { Card, Group, Progress, Skeleton, Text, Tooltip } from '@mantine/core';
import { IconDatabase } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { formatBytes } from '@/helpers/mediaLibrary';
import { MEDIA_KIND_LABEL } from '@/services/media.service';
import { statsService } from '@/services/stats.service';

const KIND_COLOR: Record<string, string> = {
  model: 'indigo', image: 'teal', audio: 'blue', subtitle: 'grape',
};

/** Thanh hiển thị trực quan dung lượng Supabase Storage đã dùng, phân bổ theo loại tệp. */
export function StorageQuotaBar() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['stats', 'storage'],
    queryFn: () => statsService.storage(),
  });

  if (isLoading) return <Skeleton height={86} radius="sm" mb="md" />;
  if (isError || !data) return null;

  const total = data.totalBytes || 1;
  const kinds = [...data.byKind].sort((a, b) => b.bytes - a.bytes);

  return (
    <Card withBorder p="md" mb="md" radius="sm">
      <Group justify="space-between" mb="xs" wrap="wrap">
        <Group gap={8}>
          <IconDatabase size={18} />
          <Text fw={600} size="sm">Dung lượng lưu trữ đã dùng</Text>
        </Group>
        <Text size="sm" c="dimmed">{formatBytes(data.totalBytes)} · {data.totalCount} tệp</Text>
      </Group>

      <Progress.Root size="xl" radius="sm">
        {kinds.map((k) => (
          <Tooltip key={k.kind} label={`${MEDIA_KIND_LABEL[k.kind as keyof typeof MEDIA_KIND_LABEL] ?? k.kind}: ${formatBytes(k.bytes)} (${k.count} tệp)`}>
            <Progress.Section value={(k.bytes / total) * 100} color={KIND_COLOR[k.kind] ?? 'gray'} />
          </Tooltip>
        ))}
      </Progress.Root>

      <Group gap="md" mt="xs" wrap="wrap">
        {kinds.map((k) => (
          <Group key={k.kind} gap={6}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: `var(--mantine-color-${KIND_COLOR[k.kind] ?? 'gray'}-6)` }} />
            <Text size="xs" c="dimmed">
              {MEDIA_KIND_LABEL[k.kind as keyof typeof MEDIA_KIND_LABEL] ?? k.kind} · {formatBytes(k.bytes)}
            </Text>
          </Group>
        ))}
      </Group>
    </Card>
  );
}
