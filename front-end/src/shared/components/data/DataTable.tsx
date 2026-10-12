import type { ReactNode } from 'react';
import { Box, Center, Group, Loader, Pagination, ScrollArea, Table, Text } from '@mantine/core';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
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
}: DataTableProps<T>) {
  const totalPages = total && pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 0;

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
              {columns.map((col) => (
                <Table.Th key={col.key} style={{ width: col.width, textAlign: col.align }}>
                  {col.header}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Tr>
                <Table.Td colSpan={columns.length}>
                  <Center py="xl">
                    <Loader size="sm" />
                  </Center>
                </Table.Td>
              </Table.Tr>
            ) : data.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={columns.length}>
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
                  {columns.map((col) => (
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
