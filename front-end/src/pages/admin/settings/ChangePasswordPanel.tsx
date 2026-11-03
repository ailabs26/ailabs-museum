import { useState } from 'react';
import { Alert, Button, Paper, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconLock } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiException } from '@/core/api/api-error';
import { authService } from '@/services/auth.service';
import { notify } from '@/shared/components/feedback';
import { useAuth } from '@/core/auth/use-auth';
import { passwordError } from '@/helpers/passwordPolicy';
import { FormPassword, PasswordStrength } from '@/shared/components/form';

interface ChangePasswordValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** Người dùng tự đổi mật khẩu; các thiết bị khác bị đăng xuất ngay, thiết bị này giữ đăng nhập. */
export function ChangePasswordPanel() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const passwordContext = { email: user?.email, displayName: user?.displayName };
  const form = useForm<ChangePasswordValues>({
    initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    validate: {
      currentPassword: (value) => (value ? null : 'Nhập mật khẩu hiện tại'),
      newPassword: (value, values) => {
        if (value === values.currentPassword) return 'Mật khẩu mới phải khác mật khẩu hiện tại';
        return passwordError(value, passwordContext);
      },
      confirmPassword: (value, values) => (value === values.newPassword ? null : 'Mật khẩu nhập lại không khớp'),
    },
  });

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordValues) =>
      authService.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
    onSuccess: () => {
      notify.success('Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.');
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
    },
    onError: (err) => {
      const apiError = err instanceof ApiException ? err : null;
      const fieldErrors = apiError?.fieldErrors ?? {};
      if (Object.keys(fieldErrors).length) {
        form.setErrors(fieldErrors);
        setError(null);
      } else {
        setError(apiError?.message ?? 'Đổi mật khẩu thất bại');
      }
    },
  });

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">Sau khi đổi, mọi thiết bị khác sẽ bị đăng xuất ngay. Thiết bị này vẫn giữ đăng nhập.</Text>
      <Paper withBorder p="lg" radius="md" maw={480}>
        <form noValidate onSubmit={form.onSubmit((values) => { setError(null); mutation.mutate(values); })}>
          <Stack>
            {error && <Alert color="red" role="alert">{error}</Alert>}
            <FormPassword label="Mật khẩu hiện tại" autoComplete="current-password" required
              {...form.getInputProps('currentPassword')} />
            <FormPassword label="Mật khẩu mới" description="Tối thiểu 10 ký tự, có chữ và số; không cần ký tự đặc biệt"
              autoComplete="new-password" required {...form.getInputProps('newPassword')} />
            <PasswordStrength value={form.values.newPassword} context={passwordContext} />
            <FormPassword label="Nhập lại mật khẩu mới" autoComplete="new-password" required
              {...form.getInputProps('confirmPassword')} />
            <Button type="submit" leftSection={<IconLock size={16} />} loading={mutation.isPending}>
              Đổi mật khẩu
            </Button>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
