import { useState } from 'react';
import {
  Badge,
  Drawer,
  Group,
  Stack,
  Table,
  Tabs,
  Text,
} from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Column, DataTable } from '@/shared/components/data';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { moderationService, Revision } from '@/services/moderation.service';

const STATE_COLOR: Record<string, string> = {
  draft: 'gray',
  in_review: 'yellow',
  approved: 'teal',
  rejected: 'red',
};

const STATE_VI: Record<string, string> = {
  draft: 'Nháp',
  in_review: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function ModerationPage() {
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  const queueQuery = useQuery({
    queryKey: ['moderation', 'queue', page],
    queryFn: () => moderationService.queue({ page, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });

  const detailQuery = useQuery({
    queryKey: ['moderation', 'revision', detailId],
    queryFn: () => moderationService.getRevision(detailId!),
    enabled: !!detailId,
  });

  const diffQuery = useQuery({
    queryKey: ['moderation', 'diff', detailId],
    queryFn: () => moderationService.diff(detailId!),
    enabled: !!detailId,
  });

  const detail = detailQuery.data;

  const historyQuery = useQuery({
    queryKey: ['moderation', 'history', detail?.exhibitId],
    queryFn: () => moderationService.history(detail!.exhibitId),
    enabled: !!detail?.exhibitId,
  });

  const columns: Column<Revision>[] = [
    {
      key: 'name',
      header: 'Hiện vật',
      render: (r) => (
        <Stack gap={2}>
          <Text fw={600} size="sm">
            {r.content.name}
          </Text>
          <Text size="xs" c="dimmed">
            Bản #{r.revisionNo}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'createdBy',
      header: 'Người gửi',
      render: (r) => r.createdBy?.displayName ?? <Text c="dimmed">—</Text>,
    },
    {
      key: 'state',
      header: 'Trạng thái',
      render: (r) => (
        <Badge color={STATE_COLOR[r.state] ?? 'gray'} variant="light">
          {STATE_VI[r.state] ?? r.state}
        </Badge>
      ),
    },
    { key: 'createdAt', header: 'Gửi lúc', render: (r) => formatTime(r.createdAt) },
  ];

  const data = queueQuery.data;

  return (
    <>
      <PageHeader
        title="Kiểm duyệt nội dung"
        description="Duyệt, từ chối hoặc tạm ẩn các phiên bản nội dung đang chờ"
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        rowKey={(r) => r.id}
        loading={queueQuery.isLoading}
        onRowClick={(r) => setDetailId(r.id)}
        page={data?.page}
        pageSize={data?.pageSize}
        total={data?.total}
        onPageChange={setPage}
        emptyText="Không có phiên bản nào chờ duyệt"
        minWidth={680}
      />

      <Drawer
        opened={!!detailId}
        onClose={() => setDetailId(null)}
        position="right"
        size="lg"
        title={
          <Text fw={700} size="lg">
            {detail ? detail.content.name : 'Chi tiết phiên bản'}
          </Text>
        }
      >
        {detail && (
          <Tabs defaultValue="diff">
            <Tabs.List mb="md">
              <Tabs.Tab value="diff">So sánh cũ/mới</Tabs.Tab>
              <Tabs.Tab value="history">Lịch sử phiên bản</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="diff">
              {diffQuery.data && (
                <Table withTableBorder withColumnBorders striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Trường</Table.Th>
                      <Table.Th>
                        Bản xuất bản
                        {diffQuery.data.publishedRevisionNo != null
                          ? ` (#${diffQuery.data.publishedRevisionNo})`
                          : ' (chưa có)'}
                      </Table.Th>
                      <Table.Th>Bản mới (#{diffQuery.data.targetRevisionNo})</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {diffQuery.data.fields.map((f) => (
                      <Table.Tr key={f.field} bg={f.changed ? 'yellow.0' : undefined}>
                        <Table.Td fw={500}>{f.label}</Table.Td>
                        <Table.Td c="dimmed">{f.oldValue ?? '—'}</Table.Td>
                        <Table.Td fw={f.changed ? 600 : 400}>{f.newValue ?? '—'}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="history">
              <Stack gap="xs">
                {(historyQuery.data ?? []).map((h) => (
                  <Group key={h.id} justify="space-between" wrap="nowrap">
                    <Group gap="sm">
                      <Text fw={600} size="sm">
                        #{h.revisionNo}
                      </Text>
                      <Badge color={STATE_COLOR[h.state] ?? 'gray'} variant="light" size="sm">
                        {STATE_VI[h.state] ?? h.state}
                      </Badge>
                      <Text size="xs" c="dimmed">
                        {h.createdBy?.displayName ?? '—'}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed">
                      {formatTime(h.createdAt)}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </Tabs.Panel>
          </Tabs>
        )}
      </Drawer>
    </>
  );
}
