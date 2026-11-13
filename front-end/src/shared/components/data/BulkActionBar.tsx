import { ActionIcon, Alert, Button, Group, List, Paper, SegmentedControl, Text, Tooltip } from '@mantine/core';
import { IconRestore, IconTrash } from '@tabler/icons-react';
import type { BulkAction } from '@/helpers/bulkDelete';

export interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  /** Thực hiện thao tác với các dòng đã chọn (xóa hoặc khôi phục, theo `action`). */
  onDelete: () => void;
  loading?: boolean;
  action?: BulkAction;
}

/** Thanh thao tác khi đã chọn dòng: số đã chọn · Bỏ chọn · Xóa/Khôi phục đã chọn. Ẩn khi chưa chọn gì. */
export function BulkActionBar({ count, onClear, onDelete, loading = false, action = 'delete' }: BulkActionBarProps) {
  if (count === 0) return null;
  const restore = action === 'restore';
  return (
    <Paper withBorder p="xs" mb="sm" radius="md" role="region" aria-label="Thao tác với các dòng đã chọn">
      <Group justify="space-between" wrap="wrap">
        <Text size="sm" fw={600} aria-live="polite">Đã chọn {count}</Text>
        <Group gap="xs">
          <Button variant="default" size="xs" onClick={onClear} disabled={loading}>Bỏ chọn</Button>
          <Button
            color={restore ? 'teal' : 'red'}
            size="xs"
            leftSection={restore ? <IconRestore size={14} /> : <IconTrash size={14} />}
            onClick={onDelete}
            loading={loading}
          >
            {restore ? 'Khôi phục' : 'Xóa'} đã chọn ({count})
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}

export interface BulkDeleteFailuresProps {
  failures: string[] | null;
  onClose: () => void;
  action?: BulkAction;
}

/** Liệt kê các dòng chặn cả lô (back-end tất cả hoặc không), kèm lý do. */
export function BulkDeleteFailures({ failures, onClose, action = 'delete' }: BulkDeleteFailuresProps) {
  if (!failures?.length) return null;
  const title = action === 'restore'
    ? `Không khôi phục được — ${failures.length} mục đang bị chặn, chưa có mục nào được khôi phục`
    : `Không xóa được — ${failures.length} mục đang bị chặn, chưa có mục nào bị xóa`;
  return (
    <Alert color="red" mb="sm" withCloseButton onClose={onClose} role="alert" title={title}>
      <List size="sm" spacing={2}>
        {failures.map((line) => <List.Item key={line}>{line}</List.Item>)}
      </List>
    </Alert>
  );
}

export interface TrashToggleProps {
  trash: boolean;
  onChange: (trash: boolean) => void;
}

/** Chuyển giữa danh sách đang dùng và mục Đã xóa (thùng rác). */
export function TrashToggle({ trash, onChange }: TrashToggleProps) {
  return (
    <SegmentedControl
      size="sm"
      aria-label="Chế độ danh sách"
      value={trash ? 'trash' : 'active'}
      onChange={(value) => onChange(value === 'trash')}
      data={[{ value: 'active', label: 'Đang dùng' }, { value: 'trash', label: 'Đã xóa' }]}
    />
  );
}

export interface RestoreRowButtonProps {
  /** Tên dòng cho nhãn trợ năng, vd "Khôi phục tài khoản Nguyễn A". */
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

/** Nút khôi phục một dòng trong mục Đã xóa. */
export function RestoreRowButton({ label, onClick, disabled = false }: RestoreRowButtonProps) {
  return (
    <Tooltip label="Khôi phục">
      <ActionIcon variant="subtle" color="teal" aria-label={label} disabled={disabled}
        onClick={(event) => { event.stopPropagation(); onClick(); }}>
        <IconRestore size={18} />
      </ActionIcon>
    </Tooltip>
  );
}
