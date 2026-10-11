import { Center, Loader } from '@mantine/core';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './use-auth';

/** Route guard: chưa đăng nhập -> chuyển về /admin/login (giữ lại đường quay lại). */
export function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}
