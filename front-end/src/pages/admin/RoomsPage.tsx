import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Code,
  Divider,
  Drawer,
  Flex,
  Group,
  Loader,
  Pagination,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { IconAlertCircle, IconEdit, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiException } from '@/core/api/api-error';
import { useAuth } from '@/core/auth/use-auth';
import { PERMISSIONS } from '@/core/auth/permissions';
import { confirmAction, notify } from '@/shared/components/feedback';
import { Column, DataTable, EmptyState } from '@/shared/components/data';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import {
  CreateRoomInput,
  RoomRow,
  roomsService,
  RoomStatus,
  UpdateRoomInput,
} from '@/services/rooms.service';

interface RoomFormValues {
  name: string;
  slug: string;
  description: string;
  status: RoomStatus;
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang hoạt động (active)' },
  { value: 'archived', label: 'Đã lưu trữ (archived)' },
];

const STATUS_FORM_OPTIONS = [
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'archived', label: 'Đã lưu trữ' },
];

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function RoomsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editing, setEditing] = useState<RoomRow | null>(null);
  const [opened, drawer] = useDisclosure(false);
  const [autoSlug, setAutoSlug] = useState(true);

  const canCreate = hasPermission(PERMISSIONS.ROOM_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.ROOM_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.ROOM_DELETE);

  const queryStatus = statusFilter !== 'all' ? (statusFilter as RoomStatus) : undefined;

  const roomsQuery = useQuery({
    queryKey: ['rooms', page, search, queryStatus],
    queryFn: () =>
      roomsService.list({
        page,
        pageSize: 20,
        q: search.trim() || undefined,
        status: queryStatus,
      }),
    placeholderData: keepPreviousData,
  });

  const form = useForm<RoomFormValues>({
    initialValues: {
      name: '',
      slug: '',
      description: '',
      status: 'active',
    },
    validate: {
      name: (v) => (v.trim().length === 0 ? 'Tên phòng không được để trống' : null),
      slug: (v) => {
        if (!editing) {
          if (!v || v.trim().length === 0) return 'Slug không được để trống';
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.trim())) {
            return 'Slug phải ở định dạng kebab-case (chỉ gồm chữ thường, số và gạch ngang nối)';
          }
          if (v.trim().length > 120) return 'Slug không được vượt quá 120 ký tự';
        }
        return null;
      },
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['rooms'] });

  const saveMutation = useMutation({
    mutationFn: (values: RoomFormValues) => {
      if (editing) {
        const patch: UpdateRoomInput = {
          name: values.name.trim(),
          description: values.description.trim() || undefined,
          status: values.status,
        };
        return roomsService.update(editing.id, patch);
      }
      const input: CreateRoomInput = {
        name: values.name.trim(),
        slug: values.slug.trim(),
        description: values.description.trim() || undefined,
      };
      return roomsService.create(input);
    },
    onSuccess: (saved) => {
      notify.success(
        editing
          ? `Đã cập nhật phòng "${saved.name}"`
          : `Đã tạo phòng mới "${saved.name}"`,
      );
      drawer.close();
      invalidate();
    },
    onError: (err) => {
      if (err instanceof ApiException) {
        if (err.status === 409) {
          form.setFieldError('slug', err.message);
          notify.error(err.message);
          return;
        }
        notify.error(err.message);
      } else {
        notify.error('Có lỗi xảy ra khi lưu phòng trưng bày');
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => roomsService.remove(id),
    onSuccess: () => {
      notify.success('Đã xóa mềm phòng trưng bày thành công');
      invalidate();
    },
    onError: (err) => {
      if (err instanceof ApiException) {
        notify.error(err.message);
      } else {
        notify.error('Không thể xóa phòng trưng bày');
      }
    },
  });

  const openCreate = () => {
    setEditing(null);
    setAutoSlug(true);
    form.reset();
    form.setValues({ name: '', slug: '', description: '', status: 'active' });
    drawer.open();
  };

  const openEdit = (room: RoomRow) => {
    setEditing(room);
    setAutoSlug(false);
    form.setValues({
      name: room.name,
      slug: room.slug,
      description: room.description ?? '',
      status: room.status,
    });
    drawer.open();
  };

  const handleNameChange = (name: string) => {
    form.setFieldValue('name', name);
    if (!editing && autoSlug) {
      form.setFieldValue('slug', toKebabCase(name));
    }
  };

  const handleDelete = (room: RoomRow) => {
    if (room.exhibitsCount > 0) {
      notify.error(
        `Không thể xóa phòng "${room.name}" vì đang chứa ${room.exhibitsCount} hiện vật (quy tắc BR-20). Vui lòng gỡ hoặc chuyển hiện vật trước.`,
      );
      return;
    }

    confirmAction({
      message: `Bạn có chắc chắn muốn xóa mềm phòng "${room.name}" (${room.slug})?`,
      danger: true,
      onConfirm: () => removeMutation.mutate(room.id),
    });
  };

  const columns: Column<RoomRow>[] = [
    {
      key: 'name',
      header: 'Phòng trưng bày',
      render: (r) => (
        <Stack gap={2}>
          <Text fw={600} size="sm">
            {r.name}
          </Text>
          {r.description ? (
            <Text size="xs" c="dimmed" lineClamp={1}>
              {r.description}
            </Text>
          ) : (
            <Text size="xs" c="dimmed" fs="italic">
              Chưa có mô tả
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: 'slug',
      header: 'Slug (Định danh URL)',
      render: (r) => (
        <Code fz="xs" fw={500}>
          {r.slug}
        </Code>
      ),
    },
    {
      key: 'exhibitsCount',
      header: 'Hiện vật',
      render: (r) => (
        <Badge
          variant="light"
          color={r.exhibitsCount > 0 ? 'blue' : 'gray'}
          size="sm"
        >
          {r.exhibitsCount} hiện vật
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (r) => (
        <Badge
          color={r.status === 'active' ? 'teal' : 'gray'}
          variant={r.status === 'active' ? 'filled' : 'light'}
          size="sm"
        >
          {r.status === 'active' ? 'Hoạt động' : 'Đã lưu trữ'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Ngày tạo',
      render: (r) => (
        <Text size="xs" c="dimmed">
          {new Date(r.createdAt).toLocaleDateString('vi-VN')}
        </Text>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <Group gap={6} justify="flex-end" wrap="nowrap">
          {canUpdate && (
            <Tooltip label="Chỉnh sửa thông tin phòng">
              <ActionIcon
                variant="subtle"
                aria-label="Sửa"
                onClick={() => openEdit(r)}
              >
                <IconEdit size={18} />
              </ActionIcon>
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip
              label={
                r.exhibitsCount > 0
                  ? `Chặn xóa: Phòng chứa ${r.exhibitsCount} hiện vật (BR-20)`
                  : 'Xóa mềm phòng trưng bày'
              }
            >
              <ActionIcon
                variant="subtle"
                color={r.exhibitsCount > 0 ? 'gray' : 'red'}
                disabled={r.exhibitsCount > 0}
                aria-label="Xóa"
                onClick={() => handleDelete(r)}
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  const data = roomsQuery.data;
  const totalPages =
    data?.total && data?.pageSize ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 0;

  return (
    <>
      <PageHeader
        title="Quản lý Phòng trưng bày"
        description="Quản lý thông tin các phòng, kiểm soát trạng thái hiển thị 3D và hiện vật liên kết"
        actions={
          canCreate ? (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={openCreate}
              w={{ base: '100%', sm: 'auto' }}
            >
              Tạo phòng mới
            </Button>
          ) : undefined
        }
      />

      <Flex direction={{ base: 'column', sm: 'row' }} gap="sm" mb="md">
        <TextInput
          placeholder="Tìm theo tên phòng hoặc slug..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.currentTarget.value);
          }}
          style={{ flex: 1 }}
        />
        <Select
          data={STATUS_FILTER_OPTIONS}
          value={statusFilter}
          onChange={(val) => {
            setPage(1);
            setStatusFilter(val ?? 'all');
          }}
          w={{ base: '100%', sm: 220 }}
          clearable={false}
        />
      </Flex>

      {/* Giao diện Desktop (Table) */}
      <Box visibleFrom="sm">
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          rowKey={(r) => r.id}
          loading={roomsQuery.isLoading}
          page={data?.page}
          pageSize={data?.pageSize}
          total={data?.total}
          onPageChange={setPage}
          emptyText="Chưa có phòng trưng bày nào"
          minWidth={720}
        />
      </Box>

      {/* Giao diện Mobile (Card List) */}
      <Stack hiddenFrom="sm" gap="sm">
        {roomsQuery.isLoading ? (
          <Center py="xl">
            <Loader size="sm" />
          </Center>
        ) : (data?.items ?? []).length === 0 ? (
          <EmptyState text="Chưa có phòng trưng bày nào" />
        ) : (
          (data?.items ?? []).map((room) => (
            <Card key={room.id} withBorder radius="md" p="sm" shadow="xs">
              <Group justify="space-between" align="flex-start" wrap="nowrap" mb="xs">
                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={600} size="sm" lineClamp={1}>
                    {room.name}
                  </Text>
                  <Code fz="xs" fw={500} style={{ alignSelf: 'flex-start' }}>
                    {room.slug}
                  </Code>
                </Stack>
                <Badge
                  color={room.status === 'active' ? 'teal' : 'gray'}
                  variant={room.status === 'active' ? 'filled' : 'light'}
                  size="sm"
                >
                  {room.status === 'active' ? 'Hoạt động' : 'Đã lưu trữ'}
                </Badge>
              </Group>

              {room.description ? (
                <Text size="xs" c="dimmed" lineClamp={2} mb="xs">
                  {room.description}
                </Text>
              ) : (
                <Text size="xs" c="dimmed" fs="italic" mb="xs">
                  Chưa có mô tả
                </Text>
              )}

              <Divider my="xs" />

              <Group justify="space-between" align="center">
                <Group gap={6}>
                  <Badge
                    variant="light"
                    color={room.exhibitsCount > 0 ? 'blue' : 'gray'}
                    size="xs"
                  >
                    {room.exhibitsCount} hiện vật
                  </Badge>
                  <Text size="xs" c="dimmed">
                    {new Date(room.createdAt).toLocaleDateString('vi-VN')}
                  </Text>
                </Group>

                <Group gap={6} wrap="nowrap">
                  {canUpdate && (
                    <ActionIcon
                      variant="subtle"
                      aria-label="Sửa"
                      onClick={() => openEdit(room)}
                    >
                      <IconEdit size={18} />
                    </ActionIcon>
                  )}
                  {canDelete && (
                    <Tooltip
                      label={
                        room.exhibitsCount > 0
                          ? `Chặn xóa: Phòng chứa ${room.exhibitsCount} hiện vật (BR-20)`
                          : 'Xóa mềm phòng trưng bày'
                      }
                    >
                      <ActionIcon
                        variant="subtle"
                        color={room.exhibitsCount > 0 ? 'gray' : 'red'}
                        disabled={room.exhibitsCount > 0}
                        aria-label="Xóa"
                        onClick={() => handleDelete(room)}
                      >
                        <IconTrash size={18} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              </Group>
            </Card>
          ))
        )}

        {totalPages > 1 && data?.page && (
          <Group justify="space-between" mt="md" wrap="wrap">
            <Text size="xs" c="dimmed">
              Tổng {data.total} bản ghi
            </Text>
            <Pagination
              value={data.page}
              total={totalPages}
              onChange={setPage}
              size="sm"
            />
          </Group>
        )}
      </Stack>

      <Drawer
        opened={opened}
        onClose={drawer.close}
        title={
          <Text fw={700} size="lg">
            {editing ? 'Cập nhật phòng trưng bày' : 'Tạo phòng trưng bày mới'}
          </Text>
        }
        position="right"
        size="md"
      >
        <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
          <Stack gap="md">
            <TextInput
              label="Tên phòng"
              placeholder="Ví dụ: Phòng Khám Phá Văn Hóa Đông Sơn"
              required
              value={form.values.name}
              onChange={(e) => handleNameChange(e.currentTarget.value)}
              error={form.errors.name}
            />

            <TextInput
              label="Slug (Định danh URL)"
              placeholder="vi-du: phong-kham-pha"
              required
              disabled={Boolean(editing)}
              value={form.values.slug}
              onChange={(e) => {
                setAutoSlug(false);
                form.setFieldValue('slug', e.currentTarget.value);
              }}
              error={form.errors.slug}
              description={
                editing
                  ? 'Slug là định danh cố định (bất biến) của phòng, không thể chỉnh sửa.'
                  : 'Dùng cho đường dẫn 3D Canvas (/rooms/:slug). Tự động tạo từ tên phòng nếu không can thiệp.'
              }
            />

            <Textarea
              label="Mô tả phòng"
              placeholder="Nhập nội dung giới thiệu ngắn về chủ đề và không gian trưng bày..."
              rows={4}
              value={form.values.description}
              onChange={(e) => form.setFieldValue('description', e.currentTarget.value)}
              error={form.errors.description}
            />

            {editing && (
              <Select
                label="Trạng thái hoạt động"
                data={STATUS_FORM_OPTIONS}
                value={form.values.status}
                onChange={(val) => form.setFieldValue('status', (val as RoomStatus) ?? 'active')}
                required
                description="Phòng ở trạng thái lưu trữ sẽ bị ẩn khỏi khách tham quan 3D."
              />
            )}

            {editing && editing.exhibitsCount > 0 && (
              <Group gap="xs" p="xs" bg="blue.0" style={{ borderRadius: 6 }}>
                <IconAlertCircle size={18} color="var(--mantine-color-blue-6)" />
                <Text size="xs" c="blue.8">
                  Phòng này hiện đang chứa <b>{editing.exhibitsCount} hiện vật</b>. Để xóa phòng, trước hết bạn cần gỡ hoặc di chuyển các hiện vật này theo quy tắc BR-20.
                </Text>
              </Group>
            )}

            <Group justify="flex-end" mt="xl">
              <Button variant="default" onClick={drawer.close}>
                Hủy
              </Button>
              <Button type="submit" loading={saveMutation.isPending}>
                {editing ? 'Lưu thay đổi' : 'Tạo phòng'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Drawer>
    </>
  );
}

