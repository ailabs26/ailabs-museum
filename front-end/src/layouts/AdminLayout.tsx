import { IconDevices, IconLogout, IconSearch, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react';
import {
  AppShell, Avatar, Badge, Box, Burger, Group, Indicator, Kbd, Menu, NavLink,
  ScrollArea, Text, Tooltip, UnstyledButton, useComputedColorScheme, useMantineColorScheme,
} from '@mantine/core';
import { IconMoonStars, IconSun } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { NavLink as RouterNavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/core/auth/use-auth';
import { ApiException } from '@/core/api/api-error';
import { notify } from '@/shared/components/feedback';
import { ADMIN_NAV, type NavItem } from '@/layouts/adminNav';
import { CommandPalette } from '@/components/cms/CommandPalette';
import { NotificationCenter } from '@/components/cms/NotificationCenter';
import { statsService } from '@/services/stats.service';

export function AdminLayout() {
  const [opened, { toggle }] = useDisclosure();
  const [collapsed, setCollapsed] = useState(false);
  const [palette, setPalette] = useState(false);
  const { user, logout, hasAnyPermission, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light', { getInitialValueInEffect: true });

  const { data: overview } = useQuery({ queryKey: ['stats', 'overview'], queryFn: () => statsService.overview() });
  const badgeOf = (item: NavItem): number | undefined =>
    item.badgeKey === 'inReview' ? overview?.revisions.inReview
    : item.badgeKey === 'reportsOpen' ? overview?.reports.open : undefined;

  const canSee = (item: NavItem) => {
    const matchesAny = !item.anyOf?.length || hasAnyPermission(item.anyOf);
    const matchesAll = !item.allOf?.length || item.allOf.every(hasPermission);
    return matchesAny && matchesAll;
  };
  const visibleItems = ADMIN_NAV.flatMap((g) => g.items).filter(canSee);

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
      navbar={{ width: collapsed ? 76 : 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm"
              aria-label={opened ? 'Đóng điều hướng quản trị' : 'Mở điều hướng quản trị'}
              aria-expanded={opened} aria-controls="admin-navigation" />
            <Tooltip label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}>
              <UnstyledButton visibleFrom="sm" onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'} aria-pressed={collapsed}>
                {collapsed ? <IconLayoutSidebarLeftExpand size={22} stroke={1.6} /> : <IconLayoutSidebarLeftCollapse size={22} stroke={1.6} />}
              </UnstyledButton>
            </Tooltip>
            <Text fw={700}>Aura Museum · CMS</Text>
          </Group>

          <Group gap="xs" wrap="nowrap">
            <UnstyledButton onClick={() => setPalette(true)} aria-label="Tìm nhanh (Ctrl K)"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--mantine-color-default-border)', color: 'var(--mantine-color-dimmed)' }}>
              <IconSearch size={16} />
              <Text size="sm" visibleFrom="md">Tìm nhanh</Text>
              <Kbd visibleFrom="md" size="xs">Ctrl K</Kbd>
            </UnstyledButton>
            <NotificationCenter />
            <Tooltip label={scheme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}>
              <UnstyledButton onClick={() => setColorScheme(scheme === 'dark' ? 'light' : 'dark')}
                aria-label={scheme === 'dark' ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối'}>
                {scheme === 'dark' ? <IconSun size={20} stroke={1.6} /> : <IconMoonStars size={20} stroke={1.6} />}
              </UnstyledButton>
            </Tooltip>
            <Menu position="bottom-end" withArrow>
              <Menu.Target>
                <UnstyledButton aria-label={`Tài khoản ${user?.displayName ?? 'Admin'}`}>
                  <Group gap="xs">
                    <Avatar color="aura" radius="xl" size={32}>{user?.displayName?.charAt(0)?.toUpperCase() ?? 'A'}</Avatar>
                    <Box visibleFrom="sm">
                      <Text size="sm" fw={600}>{user?.displayName ?? 'Admin'}</Text>
                      <Text size="xs" c="dimmed">{user?.roles?.join(', ')}</Text>
                    </Box>
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconDevices size={16} />} onClick={() => navigate('/admin/sessions')}>
                  Phiên đăng nhập
                </Menu.Item>
                <Menu.Item leftSection={<IconLogout size={16} />} onClick={handleLogout}>Đăng xuất</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar id="admin-navigation" p="xs" aria-label="Điều hướng quản trị">
        <ScrollArea>
          {ADMIN_NAV.map((group) => {
            const visible = group.items.filter(canSee);
            if (visible.length === 0) return null;
            return (
              <Box key={group.section} mb="sm">
                {collapsed
                  ? <Box style={{ height: 1, background: 'var(--mantine-color-default-border)', margin: '8px 10px' }} />
                  : <Text size="xs" c="dimmed" fw={700} tt="uppercase" px="sm" py={6}>{group.section}</Text>}
                {visible.map((item) => {
                  const badge = badgeOf(item);
                  const isActive = location.pathname === item.to;
                  if (collapsed) {
                    return (
                      <Tooltip key={item.to} label={item.label} position="right" withArrow>
                        <NavLink component={RouterNavLink} to={item.to} end={item.to === '/admin'} active={isActive}
                          aria-label={item.label} style={{ justifyContent: 'center', borderRadius: 8 }}
                          leftSection={
                            <Indicator color="red" size={8} disabled={!badge} offset={2}>
                              <item.icon size={20} stroke={1.6} />
                            </Indicator>
                          } />
                      </Tooltip>
                    );
                  }
                  return (
                    <NavLink key={item.to} component={RouterNavLink} to={item.to} end={item.to === '/admin'}
                      label={item.label} active={isActive} leftSection={<item.icon size={18} stroke={1.6} />}
                      rightSection={badge ? <Badge size="sm" color="red" variant="filled" circle>{badge}</Badge> : undefined} />
                  );
                })}
              </Box>
            );
          })}
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>

      <CommandPalette items={visibleItems} opened={palette} onOpen={() => setPalette(true)} onClose={() => setPalette(false)} />
    </AppShell>
  );
}
