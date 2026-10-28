import { useMemo, useState } from 'react';
import {
  Alert, Badge, Button, Code, CopyButton, Drawer, Group, Loader, Modal, MultiSelect,
  NumberInput, SimpleGrid, Stack, Switch, Text, TextInput, Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import {
  IconAlertCircle, IconAlertTriangle, IconCheck, IconCopy, IconKey, IconPlus,
  IconRefresh, IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/auth/use-auth';
import { PERMISSIONS } from '@/core/auth/permissions';
import {
  API_SCOPES, apiKeysService, type CreateApiKeyInput, type CreatedApiKey, type PartnerApiKey,
} from '@/services/apiKeys.service';
import { Column, DataTable } from '@/shared/components/data/DataTable';
import { StatCard } from '@/shared/components/data/StatCard';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { confirmAction } from '@/shared/components/feedback/confirm';
import { notify } from '@/shared/components/feedback/notify';

const SCOPE_LABEL = new Map(API_SCOPES.map((scope) => [scope.value, scope.label]));

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Trang quản lý danh sách API Key của đối tác. */
export function ApiKeysPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.APIKEY_MANAGE) || hasPermission(PERMISSIONS.USER_CREATE);
  const queryClient = useQueryClient();
  const [drawerOpened, drawer] = useDisclosure(false);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);

  const query = useQuery({ queryKey: ['api-keys'], queryFn: () => apiKeysService.list() });
  const rows = useMemo(() => query.data ?? [], [query.data]);
  const activeCount = rows.filter((row) => row.status === 'active').length;

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiKeysService.revoke(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      notify.success('Đã thu hồi API key');
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiKeysService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      notify.success('Đã xóa API key');
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const columns: Column<PartnerApiKey>[] = [
    {
      key: 'partner', header: 'Đối tác',
      render: (row) => (
        <div>
          <Text size="sm" fw={600}>{row.partnerName}</Text>
          <Text size="xs" c="dimmed">{row.label || '—'}</Text>
        </div>
      ),
    },
    {
      key: 'key', header: 'Khóa',
      render: (row) => <Code>{row.maskedKey}</Code>,
    },
    {
      key: 'scopes', header: 'Phạm vi',
      render: (row) => (
        <Group gap={4}>
          {row.scopes.map((scope) => (
            <Badge key={scope} size="xs" variant="light">{SCOPE_LABEL.get(scope) ?? scope}</Badge>
          ))}
        </Group>
      ),
    },
    {
      key: 'status', header: 'Trạng thái', align: 'center',
      render: (row) => (
        <Badge color={row.status === 'active' ? 'teal' : 'gray'} variant={row.status === 'active' ? 'filled' : 'light'}>
          {row.status === 'active' ? 'Đang hoạt động' : 'Đã thu hồi'}
        </Badge>
      ),
    },
    { key: 'created', header: 'Ngày tạo', render: (row) => formatDate(row.createdAt) },
    { key: 'expires', header: 'Hết hạn', render: (row) => formatDate(row.expiresAt) },
    { key: 'lastUsed', header: 'Dùng gần nhất', render: (row) => formatDate(row.lastUsedAt) },
    {
      key: 'actions', header: '', align: 'right',
      render: (row) => canManage ? (
        <Group gap={4} justify="flex-end" wrap="nowrap">
          {row.status === 'active' && (
            <Tooltip label="Thu hồi">
              <Button variant="light" color="orange" size="compact-sm"
                onClick={() => confirmAction({
                  danger: true,
                  message: `Thu hồi khóa của "${row.partnerName}"? Đối tác sẽ mất quyền truy cập ngay lập tức.`,
                  confirmLabel: 'Thu hồi', onConfirm: () => revokeMutation.mutate(row.id),
                })}>Thu hồi</Button>
            </Tooltip>
          )}
          <Tooltip label="Xóa vĩnh viễn">
            <Button variant="subtle" color="red" size="compact-sm"
              onClick={() => confirmAction({
                danger: true, message: `Xóa vĩnh viễn khóa của "${row.partnerName}"?`,
                confirmLabel: 'Xóa', onConfirm: () => removeMutation.mutate(row.id),
              })}><IconTrash size={16} /></Button>
          </Tooltip>
        </Group>
      ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="API Key đối tác"
        description="Cấp, phân quyền phạm vi và thu hồi khóa truy cập API cho các đối tác tích hợp."
        actions={canManage ? (
          <Button leftSection={<IconPlus size={16} />} onClick={drawer.open}>Tạo API Key</Button>
        ) : undefined}
      />

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
        <StatCard label="Tổng số khóa" value={rows.length} icon={<IconKey size={22} />} />
        <StatCard label="Đang hoạt động" value={activeCount} color="teal" icon={<IconCheck size={22} />} />
        <StatCard label="Đã thu hồi" value={rows.length - activeCount} color="gray" icon={<IconAlertTriangle size={22} />} />
      </SimpleGrid>

      {query.isLoading ? (
        <Group justify="center" py="xl" role="status" aria-label="Đang tải API key"><Loader /></Group>
      ) : query.isError ? (
        <Alert color="red" title="Không tải được danh sách API key" icon={<IconAlertCircle size={18} />}>
          <Button mt="sm" variant="light" color="red" leftSection={<IconRefresh size={16} />}
            onClick={() => void query.refetch()}>Thử lại</Button>
        </Alert>
      ) : (
        <DataTable columns={columns} data={rows} rowKey={(row) => row.id} minWidth={960}
          emptyText="Chưa có API key nào. Nhấn “Tạo API Key” để cấp cho đối tác." />
      )}

      {canManage && (
        <CreateApiKeyDrawer opened={drawerOpened} onClose={drawer.close} onCreated={setCreatedKey} />
      )}
      <RevealKeyModal created={createdKey} onClose={() => setCreatedKey(null)} />
    </>
  );
}

function CreateApiKeyDrawer({ opened, onClose, onCreated }: {
  opened: boolean; onClose: () => void; onCreated: (created: CreatedApiKey) => void;
}) {
  const queryClient = useQueryClient();
  const [neverExpires, setNeverExpires] = useState(true);
  const form = useForm({
    initialValues: { partnerName: '', label: '', scopes: ['public:read'] as string[], expiresInDays: 365 },
    validate: {
      partnerName: (value) => (value.trim() ? null : 'Nhập tên đối tác'),
      scopes: (value) => (value.length > 0 ? null : 'Chọn ít nhất một phạm vi'),
    },
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateApiKeyInput) => apiKeysService.create(input),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      onCreated(created);
      form.reset();
      setNeverExpires(true);
      onClose();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  return (
    <Drawer opened={opened} onClose={onClose} position="right" title="Tạo API Key đối tác" size="md">
      <form onSubmit={form.onSubmit((values) => createMutation.mutate({
        partnerName: values.partnerName, label: values.label, scopes: values.scopes,
        expiresInDays: neverExpires ? null : values.expiresInDays,
      }))}>
        <Stack>
          <TextInput label="Tên đối tác" withAsterisk placeholder="Ví dụ: VietnamPlus"
            {...form.getInputProps('partnerName')} />
          <TextInput label="Nhãn/mục đích" placeholder="Nhúng tour cho báo điện tử"
            {...form.getInputProps('label')} />
          <MultiSelect label="Phạm vi (scopes)" withAsterisk searchable
            data={API_SCOPES.map((scope) => ({ value: scope.value, label: scope.label }))}
            {...form.getInputProps('scopes')} />
          <Switch label="Không hết hạn" checked={neverExpires}
            onChange={(event) => setNeverExpires(event.currentTarget.checked)} />
          {!neverExpires && (
            <NumberInput label="Hiệu lực (ngày)" min={1} max={3650}
              {...form.getInputProps('expiresInDays')} />
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Hủy</Button>
            <Button type="submit" loading={createMutation.isPending} leftSection={<IconKey size={16} />}>
              Tạo khóa
            </Button>
          </Group>
        </Stack>
      </form>
    </Drawer>
  );
}

/** Hiển thị khóa thô đúng MỘT LẦN sau khi tạo — nhắc đối tác sao chép ngay. */
function RevealKeyModal({ created, onClose }: { created: CreatedApiKey | null; onClose: () => void }) {
  return (
    <Modal opened={!!created} onClose={onClose} title="API Key đã được tạo" centered size="lg">
      {created && (
        <Stack>
          <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title="Chỉ hiển thị một lần">
            Hãy sao chép và lưu khóa ngay bây giờ. Vì lý do bảo mật, hệ thống không lưu khóa thô
            và sẽ không thể hiển thị lại.
          </Alert>
          <div>
            <Text size="sm" fw={600} mb={4}>{created.record.partnerName}</Text>
            <Group gap="xs" wrap="nowrap">
              <Code style={{ flex: 1, wordBreak: 'break-all', padding: '10px 12px' }}>{created.plaintext}</Code>
              <CopyButton value={created.plaintext} timeout={2000}>
                {({ copied, copy }) => (
                  <Button color={copied ? 'teal' : undefined} onClick={copy}
                    leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}>
                    {copied ? 'Đã chép' : 'Sao chép'}
                  </Button>
                )}
              </CopyButton>
            </Group>
          </div>
          <Group justify="flex-end">
            <Button onClick={onClose}>Tôi đã lưu khóa</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
