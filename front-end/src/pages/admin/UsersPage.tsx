import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Group,
  MultiSelect,
  Select,
  Stack,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { IconEdit, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiException } from '@/core/api/api-error';
import { useAuth } from '@/core/auth/use-auth';
import { PERMISSIONS } from '@/core/auth/permissions';
import { confirmAction, notify } from '@/shared/components/feedback';
import { Column, DataTable } from '@/shared/components/data';
import { FormPassword, FormTextField } from '@/shared/components/form';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { rolesService } from '@/services/roles.service';
import {
  CreateUserInput,
  UpdateUserInput,
  UserRow,
  usersService,
  type UserStatus,
} from '@/services/users.service';

interface UserFormValues {
  email: string;
  displayName: string;
  password: string;
  status: UserStatus;
  roleIds: string[];
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'disabled', label: 'Đã khóa' },
];

export function UsersPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [opened, drawer] = useDisclosure(false);

  const canCreate = hasPermission(PERMISSIONS.USER_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.USER_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.USER_DELETE);

  const usersQuery = useQuery({
    queryKey: ['users', page, search],
    queryFn: () => usersService.list({ page, pageSize: 20, q: search || undefined }),
    placeholderData: keepPreviousData,
  });

  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: () => rolesService.list() });
  const roleOptions = (rolesQuery.data ?? []).map((role) => ({
    value: role.id,
    label: `${role.name} (${role.code})`,
  }));
  const roleCodeById = new Map((rolesQuery.data ?? []).map((role) => [role.id, role.code]));

  const form = useForm<UserFormValues>({
    initialValues: { email: '', displayName: '', password: '', status: 'active', roleIds: [] },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Email không hợp lệ'),
      displayName: (v) => (v.trim().length > 0 ? null : 'Bắt buộc nhập tên hiển thị'),
      password: (v) =>
        editing ? (v.length === 0 || v.length >= 8 ? null : 'Tối thiểu 8 ký tự') : v.length >= 8 ? null : 'Tối thiểu 8 ký tự',
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const saveMutation = useMutation({
    mutationFn: (values: UserFormValues) => {
      if (editing) {
        const patch: UpdateUserInput = { displayName: values.displayName, status: values.status };
        if (values.password) patch.password = values.password;
        return usersService.update(editing.id, patch);
      }
      const input: CreateUserInput = {
        email: values.email,
        password: values.password,
        displayName: values.displayName,
        roleIds: values.roleIds,
      };
      return usersService.create(input);
    },
    onSuccess: async (saved) => {
      // Khi sửa, đồng bộ lại vai trò theo lựa chọn trên form.
      if (editing) await syncRoles(editing, form.values.roleIds);
      notify.success(editing ? 'Đã cập nhật người dùng' : 'Đã tạo người dùng');
      drawer.close();
      invalidate();
      void saved;
    },
    onError: (error) => notify.error(error instanceof ApiException ? error.message : 'Lưu thất bại'),
  });

  async function syncRoles(user: UserRow, nextRoleIds: string[]) {
    const current = new Set(user.roles); // theo code
    const nextCodes = new Set(nextRoleIds.map((id) => roleCodeById.get(id)).filter(Boolean) as string[]);
    const toAdd = nextRoleIds.filter((id) => !current.has(roleCodeById.get(id) ?? ''));
    const toRemove = (rolesQuery.data ?? [])
      .filter((role) => current.has(role.code) && !nextCodes.has(role.code))
      .map((role) => role.id);
    if (toAdd.length > 0) await usersService.assignRoles(user.id, toAdd);
    for (const roleId of toRemove) await usersService.removeRole(user.id, roleId);
  }

  const removeMutation = useMutation({
    mutationFn: (id: string) => usersService.remove(id),
    onSuccess: () => {
      notify.success('Đã khóa/xóa người dùng');
      invalidate();
    },
    onError: (error) => notify.error(error instanceof ApiException ? error.message : 'Xóa thất bại'),
  });

  const openCreate = () => {
    setEditing(null);
    form.setValues({ email: '', displayName: '', password: '', status: 'active', roleIds: [] });
    drawer.open();
  };

  const openEdit = (user: UserRow) => {
    setEditing(user);
    const roleIds = (rolesQuery.data ?? [])
      .filter((role) => user.roles.includes(role.code))
      .map((role) => role.id);
    form.setValues({
      email: user.email,
      displayName: user.displayName,
      password: '',
      status: user.status,
      roleIds,
    });
    drawer.open();
  };

  const columns: Column<UserRow>[] = [
    { key: 'email', header: 'Email', render: (u) => u.email },
    { key: 'displayName', header: 'Tên hiển thị', render: (u) => u.displayName },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (u) => (
        <Badge color={u.status === 'active' ? 'green' : 'gray'} variant="light">
          {u.status === 'active' ? 'Hoạt động' : 'Đã khóa'}
        </Badge>
      ),
    },
    {
      key: 'roles',
      header: 'Vai trò',
      render: (u) => (
        <Group gap={4}>
          {u.roles.length === 0 ? (
            <Badge color="gray" variant="outline">
              chưa gán
            </Badge>
          ) : (
            u.roles.map((role) => (
              <Badge key={role} variant="light" color="aura">
                {role}
              </Badge>
            ))
          )}
        </Group>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (u) => (
        <Group gap={4} justify="flex-end" wrap="nowrap">
          {canUpdate && (
            <ActionIcon variant="subtle" aria-label="Sửa" onClick={() => openEdit(u)}>
              <IconEdit size={18} />
            </ActionIcon>
          )}
          {canDelete && (
            <ActionIcon
              variant="subtle"
              color="red"
              aria-label="Khóa/xóa"
              onClick={() =>
                confirmAction({
                  message: `Khóa/xóa người dùng "${u.displayName}"?`,
                  danger: true,
                  onConfirm: () => removeMutation.mutate(u.id),
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

  const data = usersQuery.data;

  return (
    <>
      <PageHeader
        title="Tài khoản"
        description="Quản lý người dùng và vai trò"
        actions={
          canCreate ? (
            <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
              Tạo người dùng
            </Button>
          ) : undefined
        }
      />

      <TextInput
        placeholder="Tìm theo email hoặc tên..."
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => {
          setPage(1);
          setSearch(e.currentTarget.value);
        }}
        mb="md"
        maw={360}
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        rowKey={(u) => u.id}
        loading={usersQuery.isLoading}
        page={data?.page}
        pageSize={data?.pageSize}
        total={data?.total}
        onPageChange={setPage}
        emptyText="Chưa có người dùng"
      />

      <Drawer
        opened={opened}
        onClose={drawer.close}
        position="right"
        title={editing ? 'Sửa người dùng' : 'Tạo người dùng'}
      >
        <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
          <Stack>
            <FormTextField
              label="Email"
              withAsterisk
              disabled={!!editing}
              {...form.getInputProps('email')}
            />
            <FormTextField label="Tên hiển thị" withAsterisk {...form.getInputProps('displayName')} />
            <FormPassword
              label={editing ? 'Mật khẩu mới (để trống nếu giữ nguyên)' : 'Mật khẩu'}
              withAsterisk={!editing}
              {...form.getInputProps('password')}
            />
            {editing && (
              <Select
                label="Trạng thái"
                data={STATUS_OPTIONS}
                allowDeselect={false}
                {...form.getInputProps('status')}
              />
            )}
            <MultiSelect
              label="Vai trò"
              placeholder="Chọn vai trò"
              data={roleOptions}
              searchable
              {...form.getInputProps('roleIds')}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={drawer.close} type="button">
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
