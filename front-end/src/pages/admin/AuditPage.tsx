import { useState } from 'react';
import {
  Badge,
  Drawer,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconSearch } from '@tabler/icons-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Column, DataTable } from '@/shared/components/data';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { AuditRow, auditService } from '@/services/audit.service';

const RESOURCE_OPTIONS = [
  { value: 'user', label: 'Người dùng' },
  { value: 'role', label: 'Vai trò' },
  { value: 'room', label: 'Phòng trưng bày' },
  { value: 'exhibit', label: 'Hiện vật' },
  { value: 'revision', label: 'Phiên bản nội dung' },
  { value: 'report', label: 'Báo cáo vi phạm' },
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

/** Màu badge theo nhóm hành động (động từ sau dấu chấm). */
function actionColor(action: string): string {
  const verb = action.split('.').pop() ?? '';
  if (['create', 'publish', 'resolve', 'unhide'].includes(verb)) return 'teal';
  if (['update', 'assign'].includes(verb)) return 'blue';
  if (['delete', 'reject'].includes(verb)) return 'red';
  if (['hide', 'dismiss'].includes(verb)) return 'orange';
  return 'aura';
}

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [actorId, setActorId] = useState('');
  const [resourceType, setResourceType] = useState<string | null>(null);
  const [range, setRange] = useState<[Date | null, Date | null]>([null, null]);
  const [detail, setDetail] = useState<AuditRow | null>(null);

  const query = useQuery({
    queryKey: ['audit', page, action, actorId, resourceType, range[0]?.toISOString(), range[1]?.toISOString()],
    queryFn: () =>
      auditService.list({
        page,
        pageSize: 20,
        action: action || undefined,
        actorId: actorId.trim() || undefined,
        resourceType: resourceType || undefined,
        from: range[0]?.toISOString(),
        to: range[1]?.toISOString(),
      }),
    placeholderData: keepPreviousData,
  });

  const columns: Column<AuditRow>[] = [
    { key: 'occurredAt', header: 'Thời gian', render: (r) => formatTime(r.occurredAt) },
    {
      key: 'actor',
      header: 'Người thực hiện',
      render: (r) => r.actor?.email ?? <Text c="dimmed">hệ thống</Text>,
    },
    {
      key: 'action',
      header: 'Hành động',
      render: (r) => (
        <Badge variant="light" color={actionColor(r.action)}>
          {r.action}
        </Badge>
      ),
    },
    { key: 'resourceType', header: 'Đối tượng', render: (r) => r.resourceType },
  ];

  const data = query.data;

  return (
    <>
      <PageHeader title="Nhật ký hệ thống" description="Lịch sử thao tác quản trị (append-only)" />

      <Group mb="md" align="flex-end" wrap="wrap">
        <TextInput
          label="Hành động"
          placeholder="vd: user.create"
          leftSection={<IconSearch size={16} />}
          value={action}
          onChange={(e) => {
            setPage(1);
            setAction(e.currentTarget.value);
          }}
        />
        <Select
          label="Đối tượng"
          placeholder="Tất cả"
          data={RESOURCE_OPTIONS}
          clearable
          value={resourceType}
          onChange={(v) => {
            setPage(1);
            setResourceType(v);
          }}
        />
        <TextInput
          label="Actor ID"
          placeholder="UUID người thực hiện"
          value={actorId}
          onChange={(e) => {
            setPage(1);
            setActorId(e.currentTarget.value);
          }}
        />
        <DatePickerInput
          type="range"
          label="Khoảng thời gian"
          placeholder="Từ – đến"
          value={range}
          onChange={(v) => {
            setPage(1);
            setRange(v);
          }}
          clearable
          miw={240}
        />
      </Group>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        rowKey={(r) => r.id}
        loading={query.isLoading}
        onRowClick={setDetail}
        page={data?.page}
        pageSize={data?.pageSize}
        total={data?.total}
        onPageChange={setPage}
        emptyText="Chưa có nhật ký"
      />

      <Drawer
        opened={!!detail}
        onClose={() => setDetail(null)}
        position="right"
        title="Chi tiết nhật ký"
      >
        {detail && (
          <Stack gap="sm">
            <Field label="Thời gian" value={formatTime(detail.occurredAt)} />
            <Field label="Người thực hiện" value={detail.actor?.email ?? 'hệ thống'} />
            <Field label="Hành động" value={detail.action} />
            <Field label="Đối tượng" value={detail.resourceType} />
            <Field label="Resource ID" value={detail.resourceId} />
            {detail.revisionId && <Field label="Revision ID" value={detail.revisionId} />}
            <Field label="Request ID" value={detail.requestId} />
            {detail.reason && <Field label="Lý do" value={detail.reason} />}
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
      <Text size="sm" style={{ wordBreak: 'break-all' }}>
        {value}
      </Text>
    </div>
  );
}
