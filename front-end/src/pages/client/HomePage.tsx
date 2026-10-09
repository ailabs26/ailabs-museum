import { Container, Stack, Text, Title, Button, Group } from '@mantine/core';
import { Link } from 'react-router-dom';

/** Trang chủ client (khung). Nội dung 2D đầy đủ sẽ dựng ở các PR client (task 16-20). */
export function HomePage() {
  return (
    <Container size="md" py={80}>
      <Stack gap="md" align="center" ta="center">
        <Title order={1}>Bảo tàng WebXR Aura</Title>
        <Text c="dimmed" maw={560}>
          Khám phá hiện vật 3D ngay trên trình duyệt — desktop, mobile và VR. Giao diện 2D luôn khả dụng,
          tiếp cận đầy đủ không cần WebGL.
        </Text>
        <Group>
          <Button component={Link} to="/collection" size="md">
            Xem bộ sưu tập
          </Button>
          <Button component={Link} to="/tour" size="md" variant="light">
            Tham quan 3D
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
