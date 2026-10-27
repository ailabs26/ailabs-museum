import type { ReactNode } from 'react';
import { Box, Center, Checkbox, Group, Loader, Pagination, ScrollArea, Table, Text, Tooltip } from '@mantine/core';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
}

/** Chọn nhiều dòng (vd xóa hàng loạt). Không truyền → bảng không có cột chọn. */
export interface RowSelection<T> {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Trả lý do nếu dòng không được chọn (checkbox bị khóa, tooltip hiện lý do). */
  disabledReason?: (row: T) => string | null;
  /** Nhãn đọc cho screen reader của từng dòng, vd tên bản ghi. */
  rowLabel?: (row: T) => string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  emptyText?: string;
  /** Độ rộng tối thiểu của bảng trong ScrollArea (mặc định 720px để tránh vỡ cột trên mobile) */
  minWidth?: number | string;
  /** phân trang (tùy chọn) */
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  selection?: RowSelection<T>;
}

/** Bảng dữ liệu dùng chung (chuẩn hóa từ grid-custom Angular). */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  onRowClick,
  emptyText = 'Chưa có dữ liệu',
  minWidth = 720,
  page,
  pageSize,
  total,
  onPageChange,
  selection,
}: DataTableProps<T>) {
  const totalPages = total && pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 0;
  const allColumns = selection ? [selectionColumn(data, rowKey, selection), ...columns] : columns;

  return (
    <Box pos="relative">
      <ScrollArea>
        <Table
          highlightOnHover={!!onRowClick}
          verticalSpacing="sm"
          striped
          stickyHeader
          style={{ minWidth }}
        >
          <Table.Thead>
            <Table.Tr>
              {allColumns.map((col) => (
                <Table.Th key={col.key} style={{ width: col.width, textAlign: col.align }}>
                  {col.header}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Tr>
                <Table.Td colSpan={allColumns.length}>
                  <Center py="xl">
                    <Loader size="sm" />
                  </Center>
                </Table.Td>
              </Table.Tr>
            ) : data.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={allColumns.length}>
                  <EmptyState text={emptyText} />
                </Table.Td>
              </Table.Tr>
            ) : (
              data.map((row) => (
                <Table.Tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                >
                  {allColumns.map((col) => (
                    <Table.Td key={col.key} style={{ textAlign: col.align }}>
                      {col.render ? col.render(row) : (row as Record<string, ReactNode>)[col.key]}
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      {totalPages > 1 && page && onPageChange && (
        <Group justify="space-between" mt="md">
          <Text size="sm" c="dimmed">
            Tổng {total} bản ghi
          </Text>
          <Pagination value={page} total={totalPages} onChange={onPageChange} size="sm" />
        </Group>
      )}
    </Box>
  );
}

/** Cột checkbox đầu bảng: header chọn/bỏ mọi dòng CHỌN ĐƯỢC của trang hiện tại. */
function selectionColumn<T>(data: T[], rowKey: (row: T) => string, selection: RowSelection<T>): Column<T> {
  const { selectedIds, onChange, disabledReason, rowLabel } = selection;
  const selected = new Set(selectedIds);
  const selectableIds = data.filter((row) => !disabledReason?.(row)).map(rowKey);
  const checkedCount = selectableIds.filter((id) => selected.has(id)).length;
  const allChecked = selectableIds.length > 0 && checkedCount === selectableIds.length;

  const toggleAll = () => {
    const pageIds = new Set(selectableIds);
    const others = selectedIds.filter((id) => !pageIds.has(id));
    onChange(allChecked ? others : [...others, ...selectableIds]);
  };
  const toggleRow = (id: string) =>
    onChange(selected.has(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);

  return {
    key: '__select',
    width: 40,
    header: (
      <Checkbox
        aria-label="Chọn tất cả dòng trên trang này"
        checked={allChecked}
        indeterminate={checkedCount > 0 && !allChecked}
        disabled={selectableIds.length === 0}
        onChange={toggleAll}
      />
    ),
    render: (row) => {
      const id = rowKey(row);
      const reason = disabledReason?.(row) ?? null;
      const box = (
        <Checkbox
          aria-label={`Chọn ${rowLabel?.(row) ?? 'dòng'}`}
          checked={!reason && selected.has(id)}
          disabled={!!reason}
          onChange={() => toggleRow(id)}
          // Không để click vào ô chọn mở luôn dòng (onRowClick).
          onClick={(event) => event.stopPropagation()}
        />
      );
      return reason ? <Tooltip label={reason}><span>{box}</span></Tooltip> : box;
    },
  };
}
