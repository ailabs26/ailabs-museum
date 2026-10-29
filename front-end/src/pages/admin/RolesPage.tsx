import { useRef, useState } from 'react';
import { ActionIcon, Badge, Button, Drawer, Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiException } from '@/core/api/api-error';
import { useAuth } from '@/core/auth/use-auth';
import { PERMISSIONS } from '@/core/auth/permissions';
import { confirmAction, notify } from '@/shared/components/feedback';
import {
  BulkActionBar, BulkDeleteFailures, Column, DataTable, RestoreRowButton, TrashToggle,
} from '@/shared/components/data';
import { formatDeletedAt } from '@/helpers/bulkDelete';
import { useBulkDelete, useBulkRestore } from '@/shared/hooks/useBulkDelete';
import { useRowSelection } from '@/shared/hooks/useRowSelection';
import { FormTextField } from '@/shared/components/form';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { RoleRow, rolesService } from '@/services/roles.service';

/** Vai trò có sẵn khi cài đặt (chỉ để gắn nhãn). */
const DEFAULT_ROLES = new Set(['admin', 'moderator', 'editor']);
/** Chỉ vai trò Admin không xóa được; editor/moderator xóa được khi không ai dùng (back-end kiểm). */
const deleteBlock = (role: RoleRow) => (role.code === 'admin' ? 'Không thể xóa vai trò Admin' : null);

interface RoleFormValues {
  code: string;
  name: string;
}

export function RolesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [opened, drawer] = useDisclosure(false);
  // Mục Đã xóa (thùng rác): xem và khôi phục vai trò đã xóa mềm.
  const [trash, setTrash] = useState(false);

  const canCreate = hasPermission(PERMISSIONS.ROLE_UPDATE);
  const canDelete = hasPermission('role:delete');

  // Danh sách đang dùng giữ khóa ['roles'] (dùng chung với form tài khoản); thùng rác là ['roles', 'trash'].
  const rolesQuery = useQuery({
    queryKey: trash ? ['roles', 'trash'] : ['roles'],
    queryFn: () => rolesService.list(trash),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['roles'] });
  const selection = useRowSelection(trash ? 'roles-trash' : 'roles');
  const nameOf = (id: string) => rolesQuery.data?.find((role) => role.id === id)?.name;
  const bulk = useBulkDelete({
    removeMany: rolesService.removeMany, noun: 'vai trò', nameOf, onSuccess: selection.clear, onSettled: invalidate,
  });
  const restore = useBulkRestore({
    restoreMany: rolesService.restoreMany, noun: 'vai trò', nameOf, onSuccess: selection.clear, onSettled: invalidate,
  });
  const bulkAction = trash ? restore : bulk;

  const form = useForm<RoleFormValues>({
    initialValues: { code: '', name: '' },
    validate: {
      code: (v) =>
        editing || /^[a-z][a-z0-9_]*$/.test(v) ? null : 'Chỉ chữ thường, số, gạch dưới; bắt đầu bằng chữ',
      name: (v) => (v.trim().length > 0 ? null : 'Bắt buộc nhập tên'),
    },
  });

  const saveMutation = useMutation({
    mutationFn: (values: RoleFormValues) =>
      editing ? rolesService.update(editing.id, values.name) : rolesService.create(values),
    onSuccess: () => {
      notify.success(editing ? 'Đã cập nhật vai trò' : 'Đã tạo vai trò');
      drawer.close();
      invalidate();
    },
    onError: (error) => notify.error(error instanceof ApiException ? error.message : 'Lưu thất bại'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => rolesService.remove(id),
    onSuccess: async () => {
      notify.success('Đã xóa vai trò');
      await invalidate();
      titleRef.current?.focus();
    },
    onError: (error) => notify.error(error instanceof ApiException ? error.message : 'Xóa thất bại'),
  });

  const openCreate = () => {
    setEditing(null);
    form.setValues({ code: '', name: '' });
    drawer.open();
  };

  const openEdit = (role: RoleRow) => {
    setEditing(role);
    form.setValues({ code: role.code, name: role.name });
    drawer.open();
  };

  const columns: Column<RoleRow>[] = [
    {
      key: 'code',
      header: 'Mã',
      render: (r) => (
        <Group gap={6}>
          <strong>{r.code}</strong>
          {DEFAULT_ROLES.has(r.code) && (
            <Badge size="xs" color="gray" variant="outline">
              mặc định
            </Badge>
          )}
        </Group>
      ),
    },
    { key: 'name', header: 'Tên', render: (r) => r.name },
    {
      key: 'permissions',
      header: 'Số quyền',
      align: 'center',
      render: (r) => (
        <Badge variant="light" color="aura">
          {r.permissions.length}
        </Badge>
      ),
    },
    ...(trash ? [{ key: 'deletedAt', header: 'Ngày xóa', render: (r: RoleRow) => formatDeletedAt(r.deletedAt) }] : []),
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => trash ? (
        <Group gap={4} justify="flex-end" wrap="nowrap">
          <RestoreRowButton label={`Khôi phục vai trò ${r.name}`} disabled={restore.isPending}
            onClick={() => restore.confirmRestore([r.id])} />
        </Group>
      ) : (
        <Group gap={4} justify="flex-end" wrap="nowrap">
          {canCreate && (
            <ActionIcon variant="subtle" aria-label="Sửa tên" onClick={() => openEdit(r)}>
              <IconEdit size={18} />
            </ActionIcon>
          )}
          {canDelete && !deleteBlock(r) && (
            <ActionIcon
              variant="subtle"
              color="red"
              aria-label="Xóa"
              onClick={() =>
                confirmAction({
                  message: `Xóa vai trò "${r.name}"? Vai trò đang gán cho người dùng sẽ không xóa được.`,
                  danger: true,
                  onConfirm: () => removeMutation.mutate(r.id),
                })
              }
            >
              <IconTrash size={18} />
            </ActionIcon>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        titleRef={titleRef}
        title="Vai trò"
        description="Quản lý vai trò; cấu hình ma trận quyền ở tab Phân quyền"
        actions={
          canCreate && !trash ? (
            <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
              Tạo vai trò
            </Button>
          ) : undefined
        }
      />

      {canDelete && (
        <>
          <Group mb="md">
            <TrashToggle trash={trash} onChange={setTrash} />
          </Group>
          <BulkActionBar count={selection.selectedIds.length} onClear={selection.clear}
            action={trash ? 'restore' : 'delete'} loading={bulkAction.isPending}
            onDelete={() => (trash ? restore.confirmRestore : bulk.confirmDelete)(selection.selectedIds)} />
          <BulkDeleteFailures failures={bulkAction.failures} onClose={bulkAction.dismissFailures}
            action={trash ? 'restore' : 'delete'} />
        </>
      )}
      <DataTable
        columns={columns}
        data={rolesQuery.data ?? []}
        rowKey={(r) => r.id}
        selection={canDelete ? {
          selectedIds: selection.selectedIds,
          onChange: selection.setSelectedIds,
          disabledReason: trash ? undefined : deleteBlock,
          rowLabel: (r) => r.name,
        } : undefined}
        loading={rolesQuery.isLoading}
        emptyText={trash ? 'Không có vai trò đã xóa' : 'Chưa có vai trò'}
      />

      <Drawer
        opened={opened}
        onClose={drawer.close}
        position="right"
        title={editing ? 'Sửa vai trò' : 'Tạo vai trò'}
      >
        <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
          <Stack>
            <FormTextField
              label="Mã vai trò"
              data-autofocus={!editing || undefined}
              withAsterisk
              disabled={!!editing}
              description="Định danh ổn định, không đổi sau khi tạo"
              {...form.getInputProps('code')}
            />
            <FormTextField label="Tên hiển thị" data-autofocus={!!editing || undefined} withAsterisk {...form.getInputProps('name')} />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" type="button" onClick={drawer.close}>
                Hủy
              </Button>
              <Button type="submit" loading={saveMutation.isPending}>
                Lưu
              </Button>
            </Group>
          </Stack>
        </form>
      </Drawer>
    </>
  );
}
