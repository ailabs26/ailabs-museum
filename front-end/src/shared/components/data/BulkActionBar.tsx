import { Alert, Button, Group, List, Paper, Text } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';

export interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  loading?: boolean;
}

/** Thanh thao tác khi đã chọn dòng: số đã chọn · Bỏ chọn · Xóa đã chọn. Ẩn khi chưa chọn gì. */
export function BulkActionBar({ count, onClear, onDelete, loading = false }: BulkActionBarProps) {
  if (count === 0) return null;
  return (
    <Paper withBorder p="xs" mb="sm" radius="md" role="region" aria-label="Thao tác với các dòng đã chọn">
      <Group justify="space-between" wrap="wrap">
        <Text size="sm" fw={600} aria-live="polite">Đã chọn {count}</Text>
        <Group gap="xs">
          <Button variant="default" size="xs" onClick={onClear} disabled={loading}>Bỏ chọn</Button>
          <Button color="red" size="xs" leftSection={<IconTrash size={14} />} onClick={onDelete} loading={loading}>
            Xóa đã chọn ({count})
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}

export interface BulkDeleteFailuresProps {
  failures: string[] | null;
  onClose: () => void;
}

/** Liệt kê các dòng chặn cả lô xóa (back-end tất cả hoặc không), kèm lý do. */
export function BulkDeleteFailures({ failures, onClose }: BulkDeleteFailuresProps) {
  if (!failures?.length) return null;
  return (
    <Alert color="red" mb="sm" withCloseButton onClose={onClose} role="alert"
      title={`Không xóa được — ${failures.length} mục đang bị chặn, chưa có mục nào bị xóa`}>
      <List size="sm" spacing={2}>
        {failures.map((line) => <List.Item key={line}>{line}</List.Item>)}
      </List>
    </Alert>
  );
}
