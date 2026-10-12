import { useState } from 'react';
import {
  Badge,
  Divider,
  Drawer,
  Group,
  Select,
  Stack,
  Text,
} from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Column, DataTable } from '@/shared/components/data';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { ContentReport, reportsService, ReportStatus } from '@/services/reports.service';

const STATUS_COLOR: Record<string, string> = {
  open: 'red',
  in_progress: 'yellow',
  resolved: 'teal',
  dismissed: 'gray',
};

const STATUS_VI: Record<string, string> = {
  open: 'Đang mở',
  in_progress: 'Đang xử lý',
  resolved: 'Đã xử lý',
  dismissed: 'Đã đóng',
};

const STATUS_FILTER = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'open', label: 'Đang mở' },
  { value: 'in_progress', label: 'Đang xử lý' },
  { value: 'resolved', label: 'Đã xử lý' },
  { value: 'dismissed', label: 'Đã đóng' },
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function ReportsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [detailId, setDetailId] = useState<string | null>(null);

  const queryStatus = status !== 'all' ? (status as ReportStatus) : undefined;

  const listQuery = useQuery({
    queryKey: ['reports', page, queryStatus],
    queryFn: () => reportsService.list({ page, pageSize: 20, status: queryStatus }),
    placeholderData: keepPreviousData,
  });

  const detailQuery = useQuery({
    queryKey: ['reports', 'detail', detailId],
    queryFn: () => reportsService.get(detailId!),
    enabled: !!detailId,
  });

  const detail = detailQuery.data;

  const columns: Column<ContentReport>[] = [
    {
      key: 'category',
      header: 'Nội dung báo cáo',
      render: (r) => (
        <Stack gap={2}>
          <Badge variant="light" size="sm">
            {r.category}
          </Badge>
          <Text size="xs" c="dimmed" lineClamp={1}>
            {r.message}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (r) => (
        <Badge color={STATUS_COLOR[r.status] ?? 'gray'} variant="light">
          {STATUS_VI[r.status] ?? r.status}
        </Badge>
      ),
    },
    {
      key: 'assignedTo',
      header: 'Người tiếp nhận',
      render: (r) => r.assignedTo?.displayName ?? <Text c="dimmed">—</Text>,
    },
    { key: 'createdAt', header: 'Gửi lúc', render: (r) => formatTime(r.createdAt) },
  ];

  const data = listQuery.data;

  return (
    <>
      <PageHeader
        title="Báo cáo vi phạm"
        description="Tiếp nhận và xử lý báo cáo nội dung sai từ người dùng"
      />

      <Group mb="md">
        <Select
          label="Trạng thái"
          data={STATUS_FILTER}
          value={status}
          onChange={(v) => {
            setPage(1);
            setStatus(v ?? 'all');
          }}
          w={220}
          clearable={false}
        />
      </Group>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        rowKey={(r) => r.id}
        loading={listQuery.isLoading}
        onRowClick={(r) => setDetailId(r.id)}
        page={data?.page}
        pageSize={data?.pageSize}
        total={data?.total}
        onPageChange={setPage}
        emptyText="Chưa có báo cáo nào"
        minWidth={680}
      />

      <Drawer
        opened={!!detailId}
        onClose={() => setDetailId(null)}
        position="right"
        size="lg"
        title={<Text fw={700} size="lg">Chi tiết báo cáo</Text>}
      >
        {detail && (
          <Stack gap="sm">
            <Field label="Nhóm vi phạm" value={detail.category} />
            <Field label="Nội dung" value={detail.message} />
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                Trạng thái
              </Text>
              <Badge color={STATUS_COLOR[detail.status] ?? 'gray'} variant="light" size="sm">
                {STATUS_VI[detail.status] ?? detail.status}
              </Badge>
            </Group>
            {detail.assignedTo && (
              <Field label="Người tiếp nhận" value={detail.assignedTo.displayName} />
            )}
            {detail.resolution && <Field label="Kết luận" value={detail.resolution} />}

            <Divider label="Phiên bản bị báo cáo" labelPosition="left" my="xs" />
            {detail.reportedRevision ? (
              <Stack gap="xs">
                <Field
                  label="Phiên bản"
                  value={`#${detail.reportedRevision.revisionNo} (${detail.reportedRevision.state})`}
                />
                <Field label="Tên hiện vật" value={detail.reportedRevision.content.name} />
                <Field label="Mô tả" value={detail.reportedRevision.content.description} />
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                Báo cáo không gắn với phiên bản cụ thể.
              </Text>
            )}
          </Stack>
        )}
      </Drawer>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
        {value}
      </Text>
    </div>
  );
}
