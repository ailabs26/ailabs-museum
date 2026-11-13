import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Paper,
  Table,
  Text,
} from '@mantine/core';
import { IconAlertCircle, IconDeviceFloppy, IconRefresh } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ApiException } from '@/core/api/api-error';
import { PERMISSIONS } from '@/core/auth/permissions';
import { useAuth } from '@/core/auth/use-auth';
import type { PermissionRow, RoleRow } from '@/services/roles.service';
import { rolesService } from '@/services/roles.service';
import { EmptyState } from '@/shared/components/data/EmptyState';
import { notify } from '@/shared/components/feedback';
import { PageHeader } from '@/shared/components/layout/PageHeader';

type Matrix = Record<string, Set<string>>;

function buildMatrix(roles: RoleRow[]): Matrix {
  return Object.fromEntries(roles.map((role) => [role.id, new Set(role.permissions)]));
}

function groupByResource(permissions: PermissionRow[]): Record<string, PermissionRow[]> {
  return permissions.reduce<Record<string, PermissionRow[]>>((groups, permission) => {
    const resource = permission.code.split(':')[0] ?? 'khác';
    (groups[resource] ??= []).push(permission);
    return groups;
  }, {});
}

export function PermissionMatrixPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = hasPermission(PERMISSIONS.ROLE_UPDATE);
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: () => rolesService.list() });
  const permissionsQuery = useQuery({
    queryKey: ['permissions'],
    queryFn: () => rolesService.listAllPermissions(),
  });
  const [matrix, setMatrix] = useState<Matrix>({});
  const [dirtyRoleIds, setDirtyRoleIds] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (rolesQuery.data && dirtyRoleIds.size === 0) {
      setMatrix(buildMatrix(rolesQuery.data));
    }
  }, [dirtyRoleIds.size, rolesQuery.data]);

  const roles = rolesQuery.data ?? [];
  const groupedPermissions = useMemo(
    () => groupByResource(permissionsQuery.data ?? []),
    [permissionsQuery.data],
  );

  const saveMutation = useMutation({
    mutationFn: (roleIds: string[]) =>
      rolesService.setPermissionMatrix(
        roleIds.map((roleId) => ({ roleId, permissions: [...(matrix[roleId] ?? [])] })),
      ),
    onSuccess: (updatedRoles) => {
      queryClient.setQueryData<RoleRow[]>(['roles'], (currentRoles = []) => {
        const updatesById = new Map(updatedRoles.map((role) => [role.id, role]));
        return currentRoles.map((role) => updatesById.get(role.id) ?? role);
      });
      setMatrix((current) => ({ ...current, ...buildMatrix(updatedRoles) }));
      setDirtyRoleIds(new Set());
      setSaveError(null);
      notify.success('Đã lưu ma trận quyền');
    },
    onError: (error) => {
      const message = error instanceof ApiException ? error.message : 'Không lưu được ma trận quyền';
      setSaveError(message);
      notify.error(message);
    },
  });

  const handleToggle = (roleId: string, code: string, checked: boolean) => {
    setSaveError(null);
    const nextPermissions = new Set(matrix[roleId] ?? []);
    if (checked) nextPermissions.add(code);
    else nextPermissions.delete(code);

    const savedPermissions = new Set(
      roles.find((role) => role.id === roleId)?.permissions ?? [],
    );
    const hasChanges =
      nextPermissions.size !== savedPermissions.size ||
      [...nextPermissions].some((permission) => !savedPermissions.has(permission));

    setMatrix((current) => ({ ...current, [roleId]: nextPermissions }));
    setDirtyRoleIds((current) => {
      const next = new Set(current);
      if (hasChanges) next.add(roleId);
      else next.delete(roleId);
      return next;
    });
  };

  const handleRetry = () => {
    void Promise.all([rolesQuery.refetch(), permissionsQuery.refetch()]);
  };

  const isLoading = rolesQuery.isLoading || permissionsQuery.isLoading;
  const hasLoadError = rolesQuery.isError || permissionsQuery.isError;
  const isEmpty = roles.length === 0 || (permissionsQuery.data?.length ?? 0) === 0;

  return (
    <>
      <PageHeader
        title="Ma trận phân quyền"
        description="Tích để cấp và bỏ tích để thu hồi quyền của từng vai trò. Vai trò Admin hệ thống được bảo vệ."
        actions={
          <Group>
            <Button component={Link} to="/admin/permissions" variant="default">
              Danh sách quyền
            </Button>
            {canEdit && (
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                disabled={dirtyRoleIds.size === 0}
                loading={saveMutation.isPending}
                onClick={() => saveMutation.mutate([...dirtyRoleIds])}
              >
                Lưu thay đổi{dirtyRoleIds.size > 0 ? ` (${dirtyRoleIds.size})` : ''}
              </Button>
            )}
          </Group>
        }
      />

      {saveError && (
        <Alert mb="md" color="red" title="Lưu thất bại" icon={<IconAlertCircle size={18} />}>
          {saveError}. Các thay đổi chưa lưu vẫn được giữ lại để bạn thử lại.
        </Alert>
      )}

      {isLoading ? (
        <Group justify="center" py="xl" role="status" aria-label="Đang tải ma trận phân quyền">
          <Loader />
        </Group>
      ) : hasLoadError ? (
        <Alert color="red" title="Không tải được ma trận quyền" icon={<IconAlertCircle size={18} />}>
          <Button
            mt="sm"
            variant="light"
            color="red"
            leftSection={<IconRefresh size={16} />}
            onClick={handleRetry}
          >
            Thử lại
          </Button>
        </Alert>
      ) : isEmpty ? (
        <EmptyState
          text="Chưa thể hiển thị ma trận. Cần có ít nhất một vai trò và một quyền trong hệ thống."
        />
      ) : (
        <PermissionMatrixTable
          roles={roles}
          groupedPermissions={groupedPermissions}
          matrix={matrix}
          canEdit={canEdit}
          isSaving={saveMutation.isPending}
          onToggle={handleToggle}
        />
      )}
    </>
  );
}

function PermissionMatrixTable({
  roles,
  groupedPermissions,
  matrix,
  canEdit,
  isSaving,
  onToggle,
}: {
  roles: RoleRow[];
  groupedPermissions: Record<string, PermissionRow[]>;
  matrix: Matrix;
  canEdit: boolean;
  isSaving: boolean;
  onToggle: (roleId: string, code: string, checked: boolean) => void;
}) {
  return (
    <Paper withBorder radius="md" style={{ overflow: 'auto' }}>
      <Table stickyHeader striped highlightOnHover withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ minWidth: 260 }}>Quyền</Table.Th>
            {roles.map((role) => (
              <Table.Th key={role.id} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                {role.name}
                {role.code === 'admin' && (
                  <Badge ml="xs" color="gray">
                    Được bảo vệ
                  </Badge>
                )}
                <br />
                <Text span size="xs" c="dimmed">
                  {role.code}
                </Text>
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {Object.entries(groupedPermissions).map(([resource, permissions]) => (
            <PermissionGroupRows
              key={resource}
              resource={resource}
              permissions={permissions}
              roles={roles}
              matrix={matrix}
              canEdit={canEdit}
              isSaving={isSaving}
              onToggle={onToggle}
            />
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}

function PermissionGroupRows({
  resource,
  permissions,
  roles,
  matrix,
  canEdit,
  isSaving,
  onToggle,
}: {
  resource: string;
  permissions: PermissionRow[];
  roles: RoleRow[];
  matrix: Matrix;
  canEdit: boolean;
  isSaving: boolean;
  onToggle: (roleId: string, code: string, checked: boolean) => void;
}) {
  return (
    <>
      <Table.Tr>
        <Table.Td colSpan={roles.length + 1} bg="var(--mantine-color-default-hover)">
          <Badge variant="light" color="aura" tt="uppercase">
            {resource}
          </Badge>
        </Table.Td>
      </Table.Tr>
      {permissions.map((permission) => (
        <Table.Tr key={permission.code}>
          <Table.Td>
            <Text size="sm">{permission.code}</Text>
            {permission.description && (
              <Text size="xs" c="dimmed">
                {permission.description}
              </Text>
            )}
          </Table.Td>
          {roles.map((role) => (
            <Table.Td key={role.id} style={{ textAlign: 'center' }}>
              <Checkbox
                aria-label={`${role.code} ${permission.code}`}
                checked={matrix[role.id]?.has(permission.code) ?? false}
                disabled={!canEdit || isSaving || role.code === 'admin'}
                onChange={(event) =>
                  onToggle(role.id, permission.code, event.currentTarget.checked)
                }
                style={{ display: 'inline-flex' }}
              />
            </Table.Td>
          ))}
        </Table.Tr>
      ))}
    </>
  );
}
