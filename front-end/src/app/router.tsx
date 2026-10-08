import { Route, Routes } from 'react-router-dom';
import { Container, Text, Title, Stack } from '@mantine/core';
import { PublicLayout } from '@/layouts/PublicLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
import { RequireAuth } from '@/core/auth/RequireAuth';
import { HomePage } from '@/pages/client/HomePage';
import { LoginPage } from '@/pages/admin/LoginPage';
import { DashboardPage } from '@/pages/admin/DashboardPage';
import { PlaceholderPage } from '@/pages/admin/PlaceholderPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

function ClientComingSoon({ title }: { title: string }) {
  return (
    <Container size="md" py={80}>
      <Stack align="center" ta="center">
        <Title order={2}>{title}</Title>
        <Text c="dimmed">Phần này sẽ được dựng ở các PR client (task 16–20).</Text>
      </Stack>
    </Container>
  );
}

/** Bảng định tuyến toàn ứng dụng (public + admin). */
export function AppRouter() {
  return (
    <Routes>
      {/* Client công khai */}
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="collection" element={<ClientComingSoon title="Bộ sưu tập 2D" />} />
        <Route path="tour" element={<ClientComingSoon title="Tham quan 3D / VR" />} />
      </Route>

      {/* Đăng nhập CMS (ngoài guard) */}
      <Route path="/admin/login" element={<LoginPage />} />

      {/* Khu vực quản trị (yêu cầu đăng nhập) */}
      <Route path="/admin" element={<RequireAuth />}>
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="rooms" element={<PlaceholderPage title="Phòng trưng bày" pr="PR CMS (task 6)" />} />
          <Route path="exhibits" element={<PlaceholderPage title="Hiện vật" pr="PR CMS (task 7)" />} />
          <Route path="media" element={<PlaceholderPage title="Media" pr="PR CMS (task 8)" />} />
          <Route path="moderation" element={<PlaceholderPage title="Kiểm duyệt" pr="PR (task 22)" />} />
          <Route path="reports" element={<PlaceholderPage title="Báo cáo vi phạm" pr="PR (task 23)" />} />
          <Route path="users" element={<PlaceholderPage title="Tài khoản" pr="PR #F (task 3)" />} />
          <Route path="roles" element={<PlaceholderPage title="Vai trò" pr="PR #F (task 4)" />} />
          <Route path="permissions" element={<PlaceholderPage title="Phân quyền" pr="PR #F (task 4)" />} />
          <Route path="audit" element={<PlaceholderPage title="Nhật ký hệ thống" pr="PR #F (task 24)" />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
