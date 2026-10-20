import { useEffect, useRef, useState } from 'react';
import {
  ActionIcon, Alert, Badge, Button, Drawer, Group, MultiSelect,
  Select, Stack, Text, TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { IconEdit, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiException } from '@/core/api/api-error';
import { useAuth } from '@/core/auth/use-auth';
import { PERMISSIONS } from '@/core/auth/permissions';
import { confirmAction, notify } from '@/shared/components/feedback';
import { DataTable, type Column } from '@/shared/components/data';
import { FormPassword, FormTextField } from '@/shared/components/form';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { rolesService } from '@/services/roles.service';
import {
  usersService, type CreateUserInput, type UpdateUserInput,
  type UserRow, type UserStatus,
} from '@/services/users.service';

interface UserFormValues {
  email: string;
  displayName: string;
  password: string;
  status: UserStatus;
  roleIds: string[];
}

type SaveUserInput =
  | { kind: 'create'; input: CreateUserInput }
  | { kind: 'update'; id: string; input: UpdateUserInput }
  | { kind: 'roles'; id: string; roleIds: string[] };

const STATUS_OPTIONS = [
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'disabled', label: 'Đã khóa' },
];
const EMPTY_FORM: UserFormValues = {
  email: '', displayName: '', password: '', status: 'active', roleIds: [],
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiException ? error.message : fallback;
}

export function UsersPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const formTriggerRef = useRef<HTMLElement | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [opened, drawer] = useDisclosure(false);
  const [rolesInitialized, setRolesInitialized] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canCreate = hasPermission(PERMISSIONS.USER_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.USER_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.USER_DELETE);
  const canAssignRoles = hasPermission(PERMISSIONS.ROLE_ASSIGN);
  const canReadRoles = hasPermission(PERMISSIONS.ROLE_READ);

  const usersQuery = useQuery({
    queryKey: ['users', page, debouncedSearch, status],
    queryFn: () => usersService.list({
      page, pageSize: 20, q: debouncedSearch.trim() || undefined, status: status ?? undefined,
    }),
    placeholderData: keepPreviousData,
  });
  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesService.list(),
    enabled: canReadRoles && (canCreate || canUpdate || canAssignRoles),
  });
  const roleOptions = (rolesQuery.data ?? []).map((role) => ({
    value: role.id, label: `${role.name} (${role.code})`,
  }));

  const form = useForm<UserFormValues>({
    initialValues: EMPTY_FORM,
    validate: {
      email: (value) => /^\S+@\S+\.\S+$/.test(value.trim()) ? null : 'Email không hợp lệ',
      displayName: (value) => value.trim().length > 0 && value.trim().length <= 160
        ? null : 'Tên hiển thị cần từ 1 đến 160 ký tự',
      password: (value) => editing && value.length === 0
        ? null : value.length >= 8 && value.length <= 128 ? null : 'Mật khẩu cần từ 8 đến 128 ký tự',
    },
  });

  // Chờ tải Role trước khi ánh xạ code -> ID, tránh lưu [] do dữ liệu chưa sẵn sàng.
  useEffect(() => {
    if (opened && !rolesInitialized && rolesQuery.isSuccess) {
      form.setFieldValue('roleIds', (rolesQuery.data ?? [])
        .filter((role) => editing?.roles.includes(role.code))
        .map((role) => role.id));
      setRolesInitialized(true);
    }
  }, [opened, rolesInitialized, rolesQuery.isSuccess, rolesQuery.data, editing, form]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] });
  const saveMutation = useMutation({
    mutationFn: (payload: SaveUserInput) => {
      if (payload.kind === 'create') return usersService.create(payload.input);
      if (payload.kind === 'update') return usersService.update(payload.id, payload.input);
      return usersService.setRoles(payload.id, payload.roleIds);
    },
    onSuccess: (_saved, payload) => {
      notify.success(payload.kind === 'create' ? 'Đã tạo tài khoản' : 'Đã cập nhật tài khoản');
      drawer.close();
      void invalidate();
    },
    onError: (error) => {
      setSaveError(errorMessage(error, 'Lưu tài khoản thất bại'));
      if (error instanceof ApiException) form.setErrors(error.fieldErrors);
      void invalidate();
    },
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => usersService.remove(id),
    onSuccess: async () => {
      notify.success('Đã xóa mềm tài khoản');
      if (page > 1 && usersQuery.data?.items.length === 1) setPage(page - 1);
      await invalidate();
      titleRef.current?.focus();
    },
    onError: (error) => notify.error(errorMessage(error, 'Xóa tài khoản thất bại')),
  });

  const isBusy = saveMutation.isPending || removeMutation.isPending;
  const canSelectRoles = canAssignRoles && canReadRoles
    && rolesQuery.isSuccess && rolesInitialized;
  const canSave = !editing || canUpdate || canSelectRoles;

  useEffect(() => {
    if (saveMutation.isPending) drawerRef.current?.querySelector<HTMLElement>('[role="dialog"]')?.focus();
  }, [saveMutation.isPending]);

  const openForm = (user: UserRow | null) => {
    formTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditing(user);
    setSaveError(null);
    form.clearErrors();
    form.setValues(user ? {
      email: user.email, displayName: user.displayName, password: '',
      status: user.status, roleIds: [],
    } : { ...EMPTY_FORM, roleIds: [] });
    setRolesInitialized(false);
    drawer.open();
  };
  const closeForm = () => {
    if (!saveMutation.isPending) drawer.close();
  };
  const handleSave = (values: UserFormValues) => {
    if (isBusy || !canSave) return;
    setSaveError(null);
    const roleIds = canSelectRoles ? [...values.roleIds] : undefined;
    if (!editing) {
      saveMutation.mutate({ kind: 'create', input: {
        email: values.email.trim(), displayName: values.displayName.trim(),
        password: values.password, ...(roleIds === undefined ? {} : { roleIds }),
      } });
    } else if (canUpdate) {
      saveMutation.mutate({ kind: 'update', id: editing.id, input: {
        displayName: values.displayName.trim(), status: values.status,
        ...(values.password ? { password: values.password } : {}),
        ...(roleIds === undefined ? {} : { roleIds }),
      } });
    } else if (roleIds !== undefined) {
      saveMutation.mutate({ kind: 'roles', id: editing.id, roleIds });
    }
  };

  const columns: Column<UserRow>[] = [
    { key: 'email', header: 'Email', render: (user) => user.email },
    { key: 'displayName', header: 'Tên hiển thị', render: (user) => user.displayName },
    { key: 'status', header: 'Trạng thái', render: (user) => (
      <Badge color={user.status === 'active' ? 'green' : 'gray'} variant="light">
        {user.status === 'active' ? 'Hoạt động' : 'Đã khóa'}
      </Badge>
    ) },
    { key: 'roles', header: 'Vai trò', render: (user) => (
      <Group gap={4}>
        {user.roles.length ? user.roles.map((role) => (
          <Badge key={role} variant="light" color="aura">{role}</Badge>
        )) : <Badge color="gray" variant="outline">Chưa gán</Badge>}
      </Group>
    ) },
    { key: 'actions', header: '', align: 'right', render: (user) => (
      <Group gap={4} justify="flex-end" wrap="nowrap">
        {(canUpdate || canAssignRoles) && (
          <ActionIcon variant="subtle" aria-label={canUpdate ? 'Sửa' : 'Gán vai trò'}
            disabled={isBusy} onClick={() => openForm(user)}>
            <IconEdit size={18} />
          </ActionIcon>
        )}
        {canDelete && (
          <ActionIcon variant="subtle" color="red" aria-label="Xóa tài khoản" disabled={isBusy}
            onClick={() => confirmAction({
              message: `Xóa mềm tài khoản "${user.displayName}"? Tài khoản sẽ bị loại khỏi danh sách và không đăng nhập được. Để khóa tạm thời, dùng Sửa → Trạng thái.`,
              danger: true,
              onConfirm: () => removeMutation.mutate(user.id),
            })}>
            <IconTrash size={18} />
          </ActionIcon>
        )}
      </Group>
    ) },
  ];
  const data = usersQuery.data;

  return (
    <>
      <PageHeader titleRef={titleRef} title="Tài khoản" description="Quản lý tài khoản Admin và vai trò"
        actions={canCreate ? (
          <Button leftSection={<IconPlus size={16} />} disabled={isBusy} onClick={() => openForm(null)}>
            Tạo tài khoản
          </Button>
        ) : undefined} />
      <Group mb="md" align="flex-end">
        <TextInput label="Tìm tài khoản" placeholder="Email hoặc tên..."
          leftSection={<IconSearch size={16} />} value={search}
          onChange={(event) => { setPage(1); setSearch(event.currentTarget.value); }} />
        <Select label="Trạng thái" placeholder="Tất cả" clearable data={STATUS_OPTIONS}
          value={status} onChange={(value) => { setPage(1); setStatus(value as UserStatus | null); }} />
      </Group>
      {usersQuery.isError ? (
        <Alert color="red" title="Không tải được tài khoản" role="alert">
          <Stack gap="xs">
            <Text size="sm">{errorMessage(usersQuery.error, 'Tải danh sách thất bại')}</Text>
            <Button variant="light" size="xs" onClick={() => void usersQuery.refetch()}
              loading={usersQuery.isFetching}>Thử lại</Button>
          </Stack>
        </Alert>
      ) : (
        <DataTable columns={columns} data={data?.items ?? []} rowKey={(user) => user.id}
          loading={usersQuery.isFetching} page={data?.page} pageSize={data?.pageSize}
          total={data?.total} onPageChange={setPage}
          emptyText={debouncedSearch || status ? 'Không có tài khoản phù hợp' : 'Chưa có tài khoản'} />
      )}
      <Drawer ref={drawerRef} opened={opened} onClose={closeForm} position="right"
        onExitTransitionEnd={() => {
          if (!formTriggerRef.current?.isConnected) titleRef.current?.focus();
        }}
        closeOnClickOutside={!saveMutation.isPending} closeOnEscape={!saveMutation.isPending}
        title={editing ? canUpdate ? 'Sửa tài khoản' : 'Gán vai trò' : 'Tạo tài khoản'}>
        <form onSubmit={form.onSubmit(handleSave)}>
          <fieldset disabled={saveMutation.isPending}
            style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
            <Stack>
              {saveError && <Alert color="red" title="Không lưu được tài khoản" role="alert">{saveError}</Alert>}
              <FormTextField label="Email" data-autofocus={!editing || undefined} withAsterisk disabled={!!editing || saveMutation.isPending} {...form.getInputProps('email')} />
              <FormTextField label="Tên hiển thị" data-autofocus={!!editing && canUpdate || undefined} withAsterisk disabled={(!!editing && !canUpdate) || saveMutation.isPending}
                {...form.getInputProps('displayName')} />
              {(!editing || canUpdate) && (
                <FormPassword label={editing ? 'Mật khẩu mới (để trống nếu giữ nguyên)' : 'Mật khẩu'}
                  disabled={saveMutation.isPending}
                  withAsterisk={!editing} {...form.getInputProps('password')} />
              )}
              {editing && (
                <Select label="Trạng thái" data={STATUS_OPTIONS} allowDeselect={false}
                  disabled={!canUpdate || saveMutation.isPending} {...form.getInputProps('status')} />
              )}
              {canAssignRoles && canReadRoles ? (
                <>
                  {rolesQuery.isError && (
                    <Alert color="red" title="Không tải được vai trò" role="alert">
                      <Text size="sm">{errorMessage(rolesQuery.error, 'Tải vai trò thất bại')}</Text>
                      <Text size="sm">
                        {editing ? 'Lưu thông tin sẽ giữ nguyên vai trò hiện tại.'
                          : 'Tài khoản mới sẽ chưa có vai trò nếu lưu lúc này.'}
                      </Text>
                      <Button variant="light" size="xs" onClick={() => void rolesQuery.refetch()}
                        loading={rolesQuery.isFetching}>Thử lại</Button>
                    </Alert>
                  )}
                  <MultiSelect label="Vai trò" data-autofocus={!!editing && !canUpdate || undefined} placeholder={rolesQuery.isPending ? 'Đang tải...' : 'Chọn vai trò'}
                    data={roleOptions} searchable disabled={!canSelectRoles || saveMutation.isPending} {...form.getInputProps('roleIds')} />
                  <Text size="xs" c="dimmed">Bỏ hết lựa chọn để gỡ mọi vai trò. Admin hoạt động cuối cùng được bảo vệ.</Text>
                </>
              ) : (
                <Text size="sm" c="dimmed">
                  {canAssignRoles ? 'Cần quyền role:read để tải lựa chọn vai trò.' : 'Bạn không có quyền gán vai trò.'}
                  {editing && ` Vai trò hiện tại: ${editing.roles.join(', ') || 'Chưa gán'}.`}
                </Text>
              )}
              <Text size="xs" c="dimmed">Thay đổi quyền áp dụng khi cấp access token mới; phiên đang mở có thể giữ quyền cũ đến khi token hết hạn.</Text>
              <Group justify="flex-end" mt="sm">
                <Button variant="default" disabled={saveMutation.isPending} onClick={closeForm} type="button">Hủy</Button>
                <Button type="submit" loading={saveMutation.isPending} disabled={!canSave || saveMutation.isPending}>Lưu</Button>
              </Group>
            </Stack>
          </fieldset>
        </form>
      </Drawer>
    </>
  );
}
