import { Alert, Button, Center, Group, Loader, Stack } from '@mantine/core';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './use-auth';

/**
 * Route guard: chưa đăng nhập -> chuyển về /admin/login (giữ lại đường quay lại).
 * Khôi phục phiên gặp lỗi tạm thời (429/5xx/mất mạng): phiên có thể vẫn còn, cho thử lại thay vì đá về đăng nhập.
 */
export function RequireAuth() {
  const { isAuthenticated, isLoading, restoreError, retryRestore } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }
  if (!isAuthenticated && restoreError) {
    return (
      <Center h="100vh" p="md">
        <Stack maw={440} w="100%">
          <Alert color="orange" title="Chưa khôi phục được phiên đăng nhập" role="alert">
            {restoreError}
          </Alert>
          <Group justify="flex-end">
            <Button variant="default" component={Link} to="/admin/login" state={{ from: location }}>
              Đăng nhập lại
            </Button>
            <Button onClick={retryRestore}>Thử lại</Button>
          </Group>
        </Stack>
      </Center>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}
