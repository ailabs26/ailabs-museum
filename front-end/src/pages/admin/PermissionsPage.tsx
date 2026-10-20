import { useMemo, useState } from 'react';
import { Alert, Badge, Button, Group, Loader, Paper, Table, TextInput } from '@mantine/core';
import { IconAlertCircle, IconRefresh, IconSearch, IconTable } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PERMISSIONS } from '@/core/auth/permissions';
import { useAuth } from '@/core/auth/use-auth';
import { rolesService } from '@/services/roles.service';
import { EmptyState } from '@/shared/components/data/EmptyState';
import { PageHeader } from '@/shared/components/layout/PageHeader';

export function PermissionsPage() {
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const permissionsQuery = useQuery({
    queryKey: ['permissions'],
    queryFn: () => rolesService.listAllPermissions(),
  });

  const filteredPermissions = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi');
    if (!keyword) return permissionsQuery.data ?? [];
    return (permissionsQuery.data ?? []).filter((permission) =>
      `${permission.code} ${permission.description ?? ''}`.toLocaleLowerCase('vi').includes(keyword),
    );
  }, [permissionsQuery.data, search]);

  const canOpenMatrix =
    hasPermission(PERMISSIONS.PERMISSION_READ) && hasPermission(PERMISSIONS.ROLE_READ);

  return (
    <>
      <PageHeader
        title="Danh sách quyền"
        description="Danh mục quyền RBAC do hệ thống định nghĩa. Quyền được gán cho vai trò tại ma trận phân quyền."
        actions={
          canOpenMatrix ? (
            <Button component={Link} to="/admin/permission-matrix" leftSection={<IconTable size={16} />}>
              Mở ma trận phân quyền
            </Button>
          ) : undefined
        }
      />

      {permissionsQuery.isLoading ? (
        <Group justify="center" py="xl" role="status" aria-label="Đang tải danh sách quyền">
          <Loader />
        </Group>
      ) : permissionsQuery.isError ? (
        <Alert
          color="red"
          title="Không tải được danh sách quyền"
          icon={<IconAlertCircle size={18} />}
        >
          <Button
            mt="sm"
            variant="light"
            color="red"
            leftSection={<IconRefresh size={16} />}
            onClick={() => void permissionsQuery.refetch()}
          >
            Thử lại
          </Button>
        </Alert>
      ) : (permissionsQuery.data?.length ?? 0) === 0 ? (
        <EmptyState text="Chưa có quyền nào. Danh mục quyền hiện đang trống." />
      ) : (
        <>
          <TextInput
            mb="md"
            label="Tìm quyền"
            placeholder="Ví dụ: user:read"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          {filteredPermissions.length === 0 ? (
            <EmptyState text="Không tìm thấy quyền. Hãy thử từ khóa khác." />
          ) : (
            <Paper withBorder radius="md" style={{ overflow: 'auto' }}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Mã quyền</Table.Th>
                    <Table.Th>Nhóm</Table.Th>
                    <Table.Th>Mô tả</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredPermissions.map((permission) => (
                    <Table.Tr key={permission.id}>
                      <Table.Td>{permission.code}</Table.Td>
                      <Table.Td>
                        <Badge variant="light">{permission.code.split(':')[0]}</Badge>
                      </Table.Td>
                      <Table.Td>{permission.description ?? '—'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}
        </>
      )}
    </>
  );
}
