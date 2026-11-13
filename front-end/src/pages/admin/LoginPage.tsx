import { useState } from 'react';
import { Alert, Anchor, Button, Center, Group, Loader, Paper, PinInput, Stack, Text, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { FormPassword, FormTextField } from '@/shared/components/form';
import { useAuth } from '@/core/auth/use-auth';
import { ApiException } from '@/core/api/api-error';

interface LocationState {
  from?: { pathname: string; search?: string; hash?: string };
}

export function LoginPage() {
  const { login, completeTwoFactor, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** Bước 2 (tài khoản bật 2FA): token tạm từ bước 1; null = đang ở bước nhập email/mật khẩu. */
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [code, setCode] = useState('');
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
    if (loading) {
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const challenge = await login(values);
      if (challenge) {
        setMfaToken(challenge.mfaToken);
        setCode('');
        setUseRecoveryCode(false);
        return;
      }
      navigate(destination, { replace: true });
    } catch (err) {
      const message = err instanceof ApiException ? err.message : 'Đăng nhập thất bại';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  });

  const submitTwoFactor = async (value = code) => {
    if (loading || !mfaToken) return;
    const trimmed = value.trim();
    if (useRecoveryCode ? trimmed.length < 10 : !/^\d{6}$/.test(trimmed)) {
      setErrorMessage(useRecoveryCode ? 'Mã khôi phục có dạng xxxxx-xxxxx' : 'Nhập đủ 6 chữ số');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      await completeTwoFactor(mfaToken, useRecoveryCode ? { recoveryCode: trimmed } : { code: trimmed });
      navigate(destination, { replace: true });
    } catch (err) {
      setErrorMessage(err instanceof ApiException ? err.message : 'Xác thực thất bại');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const backToPassword = () => {
    setMfaToken(null);
    setErrorMessage(null);
    form.setFieldValue('password', '');
  };

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
          <Title order={2}>{mfaToken ? 'Xác thực 2 lớp' : 'Đăng nhập CMS'}</Title>
          <Text c="dimmed" size="sm">
            {mfaToken ? 'Bước 2/2 · Nhập mã từ điện thoại' : 'Aura Museum · Quản trị hệ thống'}
          </Text>
        </Stack>
        {mfaToken ? (
          <form onSubmit={(event) => { event.preventDefault(); void submitTwoFactor(); }}>
            <Stack>
              {errorMessage && (
                <Alert color="red" role="alert" title="Xác thực thất bại">
                  {errorMessage}
                </Alert>
              )}
              {useRecoveryCode ? (
                <FormTextField
                  label="Mã khôi phục"
                  description="Một trong 10 mã bạn đã lưu khi bật xác thực 2 lớp; mỗi mã dùng một lần."
                  placeholder="xxxxx-xxxxx"
                  autoComplete="off"
                  data-autofocus
                  value={code}
                  onChange={(event) => setCode(event.currentTarget.value)}
                />
              ) : (
                <Stack gap={6}>
                  <Text size="sm" fw={500} id="mfa-code-label">Mã xác thực</Text>
                  <Text size="xs" c="dimmed">Mở app Authenticator trên điện thoại và nhập mã 6 số của Aura Museum.</Text>
                  <PinInput
                    length={6}
                    type="number"
                    oneTimeCode
                    autoFocus
                    value={code}
                    onChange={setCode}
                    onComplete={(value) => void submitTwoFactor(value)}
                    aria-labelledby="mfa-code-label"
                    getInputProps={(index) => ({ 'aria-label': `Chữ số ${index + 1} của mã xác thực` })}
                  />
                </Stack>
              )}
              <Button type="submit" loading={loading} fullWidth mt="sm">
                Xác nhận
              </Button>
              <Group justify="space-between">
                <Anchor component="button" type="button" size="sm"
                  onClick={() => { setUseRecoveryCode((v) => !v); setCode(''); setErrorMessage(null); }}>
                  {useRecoveryCode ? 'Dùng mã từ app Authenticator' : 'Dùng mã khôi phục'}
                </Anchor>
                <Anchor component="button" type="button" size="sm" c="dimmed" onClick={backToPassword}>
                  Quay lại
                </Anchor>
              </Group>
            </Stack>
          </form>
        ) : (
        <form onSubmit={handleSubmit}>
          <Stack>
            {errorMessage && (
              <Alert color="red" role="alert" title="Đăng nhập thất bại">
                {errorMessage}
              </Alert>
            )}
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
        )}
      </Paper>
    </Center>
  );
}
