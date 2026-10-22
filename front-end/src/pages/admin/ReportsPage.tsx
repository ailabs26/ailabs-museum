import { useRef, useState } from 'react';
import {
  Badge,
  Button,
  Divider,
  Drawer,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCheck, IconUserCheck, IconX } from '@tabler/icons-react';
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
import { ContentReport, reportsService, ReportStatus } from '@/services/reports.service';
import { resolveBilingualText } from '@/helpers/exhibitHotspots';

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

type CloseKind = 'resolve' | 'dismiss';

export function ReportsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const resolutionRef = useRef<HTMLTextAreaElement>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [closeKind, setCloseKind] = useState<CloseKind>('resolve');
  const [resolution, setResolution] = useState('');
  const [closeOpened, closeModal] = useDisclosure(false);

  const canResolve = hasPermission(PERMISSIONS.REPORT_RESOLVE);

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

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['reports'] });
  };

  const handleError = (err: unknown) =>
    handleCmsError(err, {
      onConflict: () => {
        refreshAll();
        closeModal.close();
        setDetailId(null);
      },
    });

  const assignMutation = useMutation({
    mutationFn: () => reportsService.assign(detail!.id),
    onSuccess: () => {
      notify.success('Đã tiếp nhận báo cáo');
      refreshAll();
    },
    onError: handleError,
  });

  const closeMutation = useMutation({
    mutationFn: () =>
      closeKind === 'resolve'
        ? reportsService.resolve(detail!.id, resolution.trim())
        : reportsService.dismiss(detail!.id, resolution.trim()),
    onSuccess: () => {
      notify.success(closeKind === 'resolve' ? 'Đã xử lý báo cáo' : 'Đã đóng báo cáo');
      closeModal.close();
      setResolution('');
      refreshAll();
      setDetailId(null);
    },
    onError: (error) => { handleError(error); resolutionRef.current?.focus(); },
  });

  const openClose = (kind: CloseKind) => {
    setCloseKind(kind);
    setResolution('');
    closeModal.open();
  };

  const isOpen = detail?.status === 'open' || detail?.status === 'in_progress';

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
        titleRef={titleRef}
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
        closeOnEscape={!closeOpened}
        onExitTransitionEnd={() => {
          if (document.activeElement === document.body) titleRef.current?.focus();
        }}
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
                <Field label="Tên hiện vật" value={resolveBilingualText(detail.reportedRevision.content.name)} />
                <Field label="Mô tả" value={resolveBilingualText(detail.reportedRevision.content.description)} />
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                Báo cáo không gắn với phiên bản cụ thể.
              </Text>
            )}

            {canResolve && isOpen && (
              <>
                <Divider my="xs" />
                <Group justify="flex-end">
                  {detail.status === 'open' && (
                    <Button
                      variant="default"
                      leftSection={<IconUserCheck size={16} />}
                      loading={assignMutation.isPending}
                      onClick={() => assignMutation.mutate()}
                    >
                      Tiếp nhận
                    </Button>
                  )}
                  <Button
                    color="gray"
                    variant="light"
                    leftSection={<IconX size={16} />}
                    onClick={() => openClose('dismiss')}
                  >
                    Đóng/bác
                  </Button>
                  <Button
                    leftSection={<IconCheck size={16} />}
                    onClick={() => openClose('resolve')}
                  >
                    Xử lý xong
                  </Button>
                </Group>
              </>
            )}
          </Stack>
        )}
      </Drawer>

      <Modal
        opened={closeOpened}
        zIndex={201}
        onExitTransitionEnd={() => {
          if (!detailId && document.activeElement === document.body) titleRef.current?.focus();
        }}
        onClose={closeModal.close}
        title={closeKind === 'resolve' ? 'Xử lý xong báo cáo' : 'Đóng/bác báo cáo'}
      >
        <Stack>
          <Textarea
            ref={resolutionRef}
            label="Kết luận xử lý"
            data-autofocus
            placeholder="Mô tả cách xử lý hoặc lý do đóng báo cáo..."
            rows={4}
            value={resolution}
            onChange={(e) => setResolution(e.currentTarget.value)}
            required
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeModal.close}>
              Hủy
            </Button>
            <Button
              color={closeKind === 'resolve' ? 'aura' : 'gray'}
              loading={closeMutation.isPending}
              disabled={resolution.trim().length === 0}
              onClick={() => closeMutation.mutate()}
            >
              Xác nhận
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

function Field({ label, value }: { label: string; value: string | { vi: string; en: string } }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
        {typeof value === 'string' ? value : value.vi || value.en}
      </Text>
    </div>
  );
}
