import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Group, Paper, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconDeviceFloppy } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { ApiException } from '@/core/api/api-error';
import { useAuth } from '@/core/auth/use-auth';
import { notify } from '@/shared/components/feedback';
import { FormTextField } from '@/shared/components/form';

/** Gom quyền `resource:action` theo resource để đọc nhanh. */
function groupPermissions(permissions: string[]): Array<[string, string[]]> {
  const groups = new Map<string, string[]>();
  for (const permission of [...permissions].sort()) {
    const [resource, action] = permission.split(':');
    groups.set(resource, [...(groups.get(resource) ?? []), action ?? permission]);
  }
  return [...groups];
}

/** Hồ sơ của chính mình: sửa tên hiển thị; email, vai trò, quyền chỉ xem (do Admin quản lý). */
export function ProfilePanel() {
  const { user, updateProfile } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    initialValues: { displayName: user?.displayName ?? '' },
    validate: {
      displayName: (value) => {
        const name = value.trim();
        return name.length > 0 && name.length <= 160 ? null : 'Tên hiển thị cần từ 1 đến 160 ký tự';
      },
    },
  });

  // Đồng bộ form khi user đổi (vd vừa lưu xong) mà không ghi đè lúc đang gõ.
  useEffect(() => {
    if (user && !form.isDirty()) form.setValues({ displayName: user.displayName });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.displayName]);

  const mutation = useMutation({
    mutationFn: (displayName: string) => updateProfile({ displayName: displayName.trim() }),
    onSuccess: () => {
      notify.success('Đã cập nhật hồ sơ');
      form.resetDirty({ displayName: form.values.displayName.trim() });
    },
    onError: (err) => {
      const apiError = err instanceof ApiException ? err : null;
      setError(apiError?.message ?? 'Cập nhật hồ sơ thất bại');
    },
  });

  if (!user) return null;
  const permissionGroups = groupPermissions(user.permissions);

  return (
    <Stack gap="md" maw={640}>
      <Paper withBorder p="lg" radius="md">
        <form noValidate onSubmit={form.onSubmit((values) => { setError(null); mutation.mutate(values.displayName); })}>
          <Stack>
            {error && <Alert color="red" role="alert">{error}</Alert>}
            <FormTextField label="Tên hiển thị" required maxLength={160} {...form.getInputProps('displayName')} />
            <TextInput label="Email" value={user.email} readOnly disabled
              description="Email đăng nhập do quản trị viên quản lý." />
            <Group justify="flex-end">
              <Button type="submit" leftSection={<IconDeviceFloppy size={16} />}
                disabled={!form.isDirty()} loading={mutation.isPending}>
                Lưu thay đổi
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>

      <Paper withBorder p="lg" radius="md">
        <Stack gap="sm">
          <Text fw={600}>Vai trò</Text>
          <Group gap={6}>
            {user.roles.length
              ? user.roles.map((role) => <Badge key={role} variant="light" color="aura">{role}</Badge>)
              : <Text size="sm" c="dimmed">Chưa được gán vai trò</Text>}
          </Group>
          <Text fw={600} mt="xs">Quyền ({user.permissions.length})</Text>
          {permissionGroups.length === 0 ? (
            <Text size="sm" c="dimmed">Không có quyền quản trị nào.</Text>
          ) : (
            <Stack gap={6}>
              {permissionGroups.map(([resource, actions]) => (
                <Group key={resource} gap={6} wrap="wrap">
                  <Text size="sm" w={110} fw={500}>{resource}</Text>
                  {actions.map((action) => <Badge key={action} size="sm" variant="outline" color="gray">{action}</Badge>)}
                </Group>
              ))}
            </Stack>
          )}
          <Text size="xs" c="dimmed">Vai trò và quyền do quản trị viên cấp; liên hệ Admin nếu cần thay đổi.</Text>
        </Stack>
      </Paper>
    </Stack>
  );
}
