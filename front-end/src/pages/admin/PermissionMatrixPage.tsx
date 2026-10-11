import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Checkbox, Group, Loader, Paper, Table, Text } from '@mantine/core';
import { IconDeviceFloppy } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiException } from '@/core/api/api-error';
import { useAuth } from '@/core/auth/use-auth';
import { PERMISSIONS } from '@/core/auth/permissions';
import { notify } from '@/shared/components/feedback';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { PermissionRow, RoleRow, rolesService } from '@/services/roles.service';

/** map roleId -> set permission codes */
type Matrix = Record<string, Set<string>>;

function buildMatrix(roles: RoleRow[]): Matrix {
  const matrix: Matrix = {};
  for (const role of roles) matrix[role.id] = new Set(role.permissions);
  return matrix;
}

function groupByResource(permissions: PermissionRow[]): Record<string, PermissionRow[]> {
  return permissions.reduce<Record<string, PermissionRow[]>>((acc, permission) => {
    const resource = permission.code.split(':')[0] ?? 'khác';
    (acc[resource] ??= []).push(permission);
    return acc;
  }, {});
}

export function PermissionMatrixPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = hasPermission(PERMISSIONS.ROLE_UPDATE);

  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: () => rolesService.list() });
  const permsQuery = useQuery({
    queryKey: ['permissions'],
    queryFn: () => rolesService.listAllPermissions(),
  });

  const [matrix, setMatrix] = useState<Matrix>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (rolesQuery.data) {
      setMatrix(buildMatrix(rolesQuery.data));
      setDirty(new Set());
    }
  }, [rolesQuery.data]);

  const roles = rolesQuery.data ?? [];
  const grouped = useMemo(() => groupByResource(permsQuery.data ?? []), [permsQuery.data]);

  const toggle = (roleId: string, code: string, checked: boolean) => {
    setMatrix((prev) => {
      const next: Matrix = { ...prev, [roleId]: new Set(prev[roleId]) };
      if (checked) next[roleId].add(code);
      else next[roleId].delete(code);
      return next;
    });
    setDirty((prev) => new Set(prev).add(roleId));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const roleId of dirty) {
        await rolesService.setPermissions(roleId, [...(matrix[roleId] ?? [])]);
      }
    },
    onSuccess: () => {
      notify.success('Đã lưu ma trận quyền');
      setDirty(new Set());
      void queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (error) => notify.error(error instanceof ApiException ? error.message : 'Lưu thất bại'),
  });

  if (rolesQuery.isLoading || permsQuery.isLoading) {
    return (
      <>
        <PageHeader title="Phân quyền" />
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Phân quyền"
        description="Ma trận vai trò × quyền. Tích để cấp, bỏ tích để thu hồi."
        actions={
          canEdit ? (
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              disabled={dirty.size === 0}
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              Lưu thay đổi{dirty.size > 0 ? ` (${dirty.size})` : ''}
            </Button>
          ) : undefined
        }
      />

      <Paper withBorder radius="md" style={{ overflow: 'auto' }}>
        <Table stickyHeader striped highlightOnHover withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ minWidth: 260 }}>Quyền</Table.Th>
              {roles.map((role) => (
                <Table.Th key={role.id} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {role.name}
                  <br />
                  <Text span size="xs" c="dimmed">
                    {role.code}
                  </Text>
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {Object.entries(grouped).map(([resource, permissions]) => (
              <GroupRows
                key={resource}
                resource={resource}
                permissions={permissions}
                roles={roles}
                matrix={matrix}
                canEdit={canEdit}
                onToggle={toggle}
              />
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    </>
  );
}

function GroupRows({
  resource,
  permissions,
  roles,
  matrix,
  canEdit,
  onToggle,
}: {
  resource: string;
  permissions: PermissionRow[];
  roles: RoleRow[];
  matrix: Matrix;
  canEdit: boolean;
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
                disabled={!canEdit}
                onChange={(e) => onToggle(role.id, permission.code, e.currentTarget.checked)}
                style={{ display: 'inline-flex' }}
              />
            </Table.Td>
          ))}
        </Table.Tr>
      ))}
    </>
  );
}
