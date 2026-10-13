import { useState } from 'react';
import { Button, Center, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { FormPassword, FormTextField } from '@/shared/components/form';
import { notify } from '@/shared/components/feedback';
import { useAuth } from '@/core/auth/use-auth';
import { ApiException } from '@/core/api/api-error';

interface LocationState {
  from?: { pathname: string; search?: string; hash?: string };
}

export function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const from = (location.state as LocationState | null)?.from;
  const canReturnToAdmin = from
    && (from.pathname === '/admin' || from.pathname.startsWith('/admin/'))
    && from.pathname !== '/admin/login';
  const destination = canReturnToAdmin
    ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
    : '/admin';

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Email không hợp lệ'),
      password: (v) => (v.length >= 8 ? null : 'Mật khẩu tối thiểu 8 ký tự'),
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    setLoading(true);
    try {
      await login(values);
      navigate(destination, { replace: true });
    } catch (err) {
      const message = err instanceof ApiException ? err.message : 'Đăng nhập thất bại';
      notify.error(message);
    } finally {
      setLoading(false);
    }
  });

  if (isLoading) {
    return (
      <Center mih="100vh" aria-label="Đang khôi phục phiên đăng nhập">
        <Loader />
      </Center>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={destination} replace />;
  }

  return (
    <Center mih="100vh" p="md">
      <Paper withBorder shadow="md" p="xl" radius="md" w={400} maw="100%" component="main">
        <Stack gap="xs" mb="lg">
          <Title order={2}>Đăng nhập CMS</Title>
          <Text c="dimmed" size="sm">
            Aura Museum · Quản trị hệ thống
          </Text>
        </Stack>
        <form onSubmit={handleSubmit}>
          <Stack>
            <FormTextField
              label="Email"
              placeholder="admin@aura.museum"
              withAsterisk
              autoComplete="email"
              {...form.getInputProps('email')}
            />
            <FormPassword
              label="Mật khẩu"
              placeholder="••••••••"
              withAsterisk
              autoComplete="current-password"
              {...form.getInputProps('password')}
            />
            <Button type="submit" loading={loading} fullWidth mt="sm">
              Đăng nhập
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
