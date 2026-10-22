import { useRef, useState } from 'react';
import {
  Badge,
  Alert,
  Button,
  Divider,
  Drawer,
  Group,
  Modal,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCheck, IconEyeOff, IconX } from '@tabler/icons-react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { handleCmsError } from '@/core/api/cms-error';
import { useAuth } from '@/core/auth/use-auth';
import { PERMISSIONS } from '@/core/auth/permissions';
import { notify } from '@/shared/components/feedback';
import { Column, DataTable } from '@/shared/components/data';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { moderationService, Revision } from '@/services/moderation.service';
import { resolveBilingualText } from '@/helpers/exhibitHotspots';

function revisionName(value: Revision['content']['name']): string {
  const { vi, en } = resolveBilingualText(value);
  return vi.trim() || en.trim() || 'Chưa đặt tên';
}

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
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const rejectReasonRef = useRef<HTMLTextAreaElement>(null);
  const didCompleteRef = useRef(false);
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [rejectOpened, rejectModal] = useDisclosure(false);
  const [rejectReason, setRejectReason] = useState('');

  const canPublish = hasPermission(PERMISSIONS.REVISION_PUBLISH);
  const canReject = hasPermission(PERMISSIONS.REVISION_REJECT);
  const canHide = hasPermission(PERMISSIONS.REVISION_HIDE);

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

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['moderation', 'queue'] });
    queryClient.invalidateQueries({ queryKey: ['moderation', 'revision', detailId] });
    queryClient.invalidateQueries({ queryKey: ['moderation', 'diff', detailId] });
  };

  /** Chuẩn hóa thông báo lỗi; 409 = sửa đồng thời → cảnh báo reload + refetch. */
  const handleError = (err: unknown) =>
    handleCmsError(err, {
      onConflict: () => {
        refreshAll();
        didCompleteRef.current = true;
        rejectModal.close();
        setDetailId(null);
      },
    });

  const publishMutation = useMutation({
    mutationFn: () => moderationService.publish(detail!.id, detail!.exhibit!.version),
    onSuccess: () => {
      notify.success('Đã xuất bản phiên bản nội dung');
      refreshAll();
      setDetailId(null);
    },
    onError: handleError,
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      moderationService.reject(detail!.id, detail!.exhibit!.version, rejectReason.trim()),
    onSuccess: () => {
      notify.success('Đã từ chối phiên bản nội dung');
      didCompleteRef.current = true;
      rejectModal.close();
      setRejectReason('');
      refreshAll();
      setDetailId(null);
    },
    onError: (error) => { handleError(error); rejectReasonRef.current?.focus(); },
  });

  const hideMutation = useMutation({
    mutationFn: () => moderationService.hide(detail!.exhibit!.id, detail!.exhibit!.version),
    onSuccess: () => {
      notify.success('Đã tạm ẩn hiện vật');
      refreshAll();
      setDetailId(null);
    },
    onError: handleError,
  });

  const columns: Column<Revision>[] = [
    {
      key: 'name',
      header: 'Hiện vật',
      render: (r) => (
        <Stack gap={2}>
          <Text fw={600} size="sm">
            {revisionName(r.content.name)}
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
    {
      key: 'actions',
      header: 'Thao tác',
      render: (revision) => (
        <Button
          variant="light"
          size="xs"
          aria-label={`Xem chi tiết ${revisionName(revision.content.name)}, bản #${revision.revisionNo}, ${revision.id}`}
          onClick={(event) => { event.stopPropagation(); setDetailId(revision.id); }}
        >
          Xem chi tiết
        </Button>
      ),
    },
  ];

  const data = queueQuery.data;

  return (
    <>
      <PageHeader
        titleRef={titleRef}
        title="Kiểm duyệt nội dung"
        description="Duyệt, từ chối hoặc tạm ẩn các phiên bản nội dung đang chờ"
        actions={<Button variant="default" loading={queueQuery.isFetching} disabled={queueQuery.isFetching}
          onClick={() => void queueQuery.refetch()}>Làm mới</Button>}
      />

      {queueQuery.isPending ? <Text role="status">Đang tải hàng chờ…</Text>
        : queueQuery.isError ? <Alert color="red" role="alert" title="Không tải được hàng chờ kiểm duyệt">
          <Text>{queueQuery.error.message}</Text>
          <Button mt="sm" onClick={() => void queueQuery.refetch()}>Thử lại</Button>
        </Alert> : <DataTable
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
      />}

      <Drawer
        opened={!!detailId}
        closeOnEscape={!rejectOpened}
        onExitTransitionEnd={() => {
          if (didCompleteRef.current || document.activeElement === document.body) titleRef.current?.focus();
          didCompleteRef.current = false;
        }}
        onClose={() => setDetailId(null)}
        position="right"
        size="lg"
        title={
          <Text fw={700} size="lg">
            {detail ? revisionName(detail.content.name) : 'Chi tiết phiên bản'}
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

        {detail && (
          <>
            <Divider my="md" />
            <Group justify="flex-end">
              {canHide && detail.exhibit && (
                <Button
                  variant="default"
                  leftSection={<IconEyeOff size={16} />}
                  loading={hideMutation.isPending}
                  onClick={() => hideMutation.mutate()}
                >
                  Tạm ẩn hiện vật
                </Button>
              )}
              {detail.state === 'in_review' && canReject && (
                <Button
                  color="red"
                  variant="light"
                  leftSection={<IconX size={16} />}
                  onClick={rejectModal.open}
                >
                  Từ chối
                </Button>
              )}
              {detail.state === 'in_review' && canPublish && (
                <Button
                  leftSection={<IconCheck size={16} />}
                  loading={publishMutation.isPending}
                  onClick={() => publishMutation.mutate()}
                >
                  Xuất bản
                </Button>
              )}
            </Group>
          </>
        )}
      </Drawer>

      <Modal opened={rejectOpened} onClose={rejectModal.close} title="Từ chối phiên bản" zIndex={201}
        onExitTransitionEnd={() => {
          if (!detailId && document.activeElement === document.body) titleRef.current?.focus();
        }}>
        <Stack>
          <Textarea
            ref={rejectReasonRef}
            label="Lý do từ chối"
            data-autofocus
            placeholder="Nêu rõ lý do để người gửi chỉnh sửa..."
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.currentTarget.value)}
            required
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={rejectModal.close}>
              Hủy
            </Button>
            <Button
              color="red"
              loading={rejectMutation.isPending}
              disabled={rejectReason.trim().length === 0}
              onClick={() => rejectMutation.mutate()}
            >
              Xác nhận từ chối
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
