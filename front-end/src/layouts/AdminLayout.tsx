import {
  IconLayoutDashboard,
  IconBuildingArch,
  IconArtboard,
  IconPhoto,
  IconChecklist,
  IconFlag,
  IconUsers,
  IconShieldLock,
  IconKey,
  IconHistory,
  IconLogout,
} from '@tabler/icons-react';
import {
  AppShell,
  Burger,
  Group,
  NavLink,
  ScrollArea,
  Text,
  Menu,
  Avatar,
  UnstyledButton,
  Box,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { NavLink as RouterNavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/core/auth/use-auth';
import { PERMISSIONS } from '@/core/auth/permissions';
import { ApiException } from '@/core/api/api-error';
import { notify } from '@/shared/components/feedback';

interface NavItem {
  label: string;
  to: string;
  icon: typeof IconLayoutDashboard;
  anyOf?: string[];
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Tổng quan',
    items: [{ label: 'Dashboard', to: '/admin', icon: IconLayoutDashboard }],
  },
  {
    section: 'Nội dung',
    items: [
      { label: 'Phòng trưng bày', to: '/admin/rooms', icon: IconBuildingArch, anyOf: [PERMISSIONS.ROOM_READ] },
      { label: 'Hiện vật', to: '/admin/exhibits', icon: IconArtboard, anyOf: [PERMISSIONS.EXHIBIT_READ] },
      { label: 'Media', to: '/admin/media', icon: IconPhoto, anyOf: [PERMISSIONS.MEDIA_UPLOAD] },
      { label: 'Kiểm duyệt', to: '/admin/moderation', icon: IconChecklist, anyOf: [PERMISSIONS.REVISION_PUBLISH] },
      { label: 'Báo cáo vi phạm', to: '/admin/reports', icon: IconFlag, anyOf: [PERMISSIONS.REPORT_READ] },
    ],
  },
  {
    section: 'Quản trị hệ thống',
    items: [
      { label: 'Tài khoản', to: '/admin/users', icon: IconUsers, anyOf: [PERMISSIONS.USER_READ] },
      { label: 'Vai trò', to: '/admin/roles', icon: IconShieldLock, anyOf: [PERMISSIONS.ROLE_READ] },
      { label: 'Phân quyền', to: '/admin/permissions', icon: IconKey, anyOf: [PERMISSIONS.PERMISSION_READ] },
      { label: 'Nhật ký hệ thống', to: '/admin/audit', icon: IconHistory, anyOf: [PERMISSIONS.AUDIT_READ] },
    ],
  },
];

export function AdminLayout() {
  const [opened, { toggle }] = useDisclosure();
  const { user, logout, hasAnyPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const canSee = (item: NavItem) => !item.anyOf || hasAnyPermission(item.anyOf);

  const handleLogout = async () => {
    try {
      await logout();
      notify.success('Đã đăng xuất khỏi CMS');
    } catch (error) {
      const message = error instanceof ApiException ? error.message : 'Không hoàn tất được đăng xuất trên máy chủ';
      notify.error(message);
    } finally {
      navigate('/admin/login', { replace: true });
    }
  };

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text fw={700}>Aura Museum · CMS</Text>
          </Group>
          <Menu position="bottom-end" withArrow>
            <Menu.Target>
              <UnstyledButton>
                <Group gap="xs">
                  <Avatar color="aura" radius="xl" size={32}>
                    {user?.displayName?.charAt(0)?.toUpperCase() ?? 'A'}
                  </Avatar>
                  <Box visibleFrom="sm">
                    <Text size="sm" fw={600}>
                      {user?.displayName ?? 'Admin'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {user?.roles?.join(', ')}
                    </Text>
                  </Box>
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconLogout size={16} />}
                onClick={handleLogout}
              >
                Đăng xuất
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <ScrollArea>
          {NAV.map((group) => {
            const visible = group.items.filter(canSee);
            if (visible.length === 0) return null;
            return (
              <Box key={group.section} mb="sm">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase" px="sm" py={6}>
                  {group.section}
                </Text>
                {visible.map((item) => (
                  <NavLink
                    key={item.to}
                    component={RouterNavLink}
                    to={item.to}
                    end={item.to === '/admin'}
                    label={item.label}
                    leftSection={<item.icon size={18} stroke={1.6} />}
                    active={location.pathname === item.to}
                  />
                ))}
              </Box>
            );
          })}
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
