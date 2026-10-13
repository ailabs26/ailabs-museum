import { Route, Routes } from 'react-router-dom';
import { Container, Text, Title, Stack } from '@mantine/core';
import { PublicLayout } from '@/layouts/PublicLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
import { RequireAuth } from '@/core/auth/RequireAuth';
import { HomePage } from '@/pages/client/HomePage';
import { CollectionPage } from '@/pages/client/CollectionPage';
import { LoginPage } from '@/pages/admin/LoginPage';
import { DashboardPage } from '@/pages/admin/DashboardPage';
import { PlaceholderPage } from '@/pages/admin/PlaceholderPage';
import { RoomsPage } from '@/pages/admin/RoomsPage';
import { UsersPage } from '@/pages/admin/UsersPage';
import { RolesPage } from '@/pages/admin/RolesPage';
import { PermissionMatrixPage } from '@/pages/admin/PermissionMatrixPage';
import { AuditPage } from '@/pages/admin/AuditPage';
import { ModerationPage } from '@/pages/admin/ModerationPage';
import { ReportsPage } from '@/pages/admin/ReportsPage';
import { RequirePermission } from '@/core/auth/RequirePermission';
import { PERMISSIONS } from '@/core/auth/permissions';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { MuseumPage } from '@/pages/MuseumPage';

/** Hiển thị khi tài khoản đăng nhập nhưng thiếu quyền xem màn hình quản trị. */
function NoAccess() {
  return (
    <Container size="md" py={80}>
      <Stack align="center" ta="center">
        <Title order={3}>Không đủ quyền</Title>
        <Text c="dimmed">Tài khoản của bạn không có quyền truy cập mục này.</Text>
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
        <Route path="collection" element={<CollectionPage />} />
        <Route path="tour" element={<MuseumPage />} />
        <Route path="tour.html" element={<MuseumPage />} />
      </Route>

      {/* Đăng nhập CMS (ngoài guard) */}
      <Route path="/admin/login" element={<LoginPage />} />

      {/* Khu vực quản trị (yêu cầu đăng nhập) */}
      <Route path="/admin" element={<RequireAuth />}>
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route
            path="rooms"
            element={
              <RequirePermission anyOf={[PERMISSIONS.ROOM_READ]} fallback={<NoAccess />}>
                <RoomsPage />
              </RequirePermission>
            }
          />
          <Route path="exhibits" element={<PlaceholderPage title="Hiện vật" pr="PR CMS (task 7)" />} />
          <Route path="media" element={<PlaceholderPage title="Media" pr="PR CMS (task 8)" />} />
          <Route
            path="moderation"
            element={
              <RequirePermission anyOf={[PERMISSIONS.REVISION_PUBLISH]} fallback={<NoAccess />}>
                <ModerationPage />
              </RequirePermission>
            }
          />
          <Route
            path="reports"
            element={
              <RequirePermission anyOf={[PERMISSIONS.REPORT_READ]} fallback={<NoAccess />}>
                <ReportsPage />
              </RequirePermission>
            }
          />
          <Route
            path="users"
            element={
              <RequirePermission anyOf={[PERMISSIONS.USER_READ]} fallback={<NoAccess />}>
                <UsersPage />
              </RequirePermission>
            }
          />
          <Route
            path="roles"
            element={
              <RequirePermission anyOf={[PERMISSIONS.ROLE_READ]} fallback={<NoAccess />}>
                <RolesPage />
              </RequirePermission>
            }
          />
          <Route
            path="permissions"
            element={
              <RequirePermission anyOf={[PERMISSIONS.PERMISSION_READ]} fallback={<NoAccess />}>
                <PermissionMatrixPage />
              </RequirePermission>
            }
          />
          <Route
            path="audit"
            element={
              <RequirePermission anyOf={[PERMISSIONS.AUDIT_READ]} fallback={<NoAccess />}>
                <AuditPage />
              </RequirePermission>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
