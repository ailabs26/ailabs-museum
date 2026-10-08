import { AppShell, Container, Group, Text } from '@mantine/core';
import { Link, Outlet } from 'react-router-dom';

/** Khung trang cho phần client công khai (trang chủ, collection, chi tiết, tour). */
export function PublicLayout() {
  return (
    <AppShell header={{ height: 56 }} padding={0}>
      <AppShell.Header>
        <Container size="lg" h="100%">
          <Group h="100%" justify="space-between">
            <Text component={Link} to="/" fw={700} td="none" c="inherit">
              Aura Museum
            </Text>
            <Group gap="lg">
              <Text component={Link} to="/collection" td="none" c="inherit" size="sm">
                Bộ sưu tập
              </Text>
              <Text component={Link} to="/tour" td="none" c="inherit" size="sm">
                Tham quan 3D
              </Text>
            </Group>
          </Group>
        </Container>
      </AppShell.Header>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
