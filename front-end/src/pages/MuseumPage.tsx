import { lazy, Suspense, useState } from 'react';
import { Button, Container, Group, Stack, Text, Title } from '@mantine/core';
import { MuseumCatalogue } from '@/components/museum/MuseumCatalogue';
import { SAMPLE_DISPLAYS } from '@/components/museum/sampleDisplays';
import { SceneFallback } from '@/components/museum/SceneFallback';
import { ErrorBoundary } from '@/shared/components/feedback/ErrorBoundary';
import classes from './MuseumPage.module.css';

const LazyMuseumScene = lazy(() => import('@/components/MuseumScene').then((module) => ({ default: module.MuseumScene })));

export function MuseumPage() {
  const [isSceneOpen, setIsSceneOpen] = useState(false);
  return (
    <Container size="xl" py="xl">
      <Stack>
        <Text size="xs" tt="uppercase" c="dimmed" fw={700}>Aura / Phòng nghiên cứu 01</Text>
        <Title order={1}>Không gian của hình khối</Title>
        <Text>Phòng trưng bày mẫu — khám phá nhịp điệu, chất liệu và ánh sáng.</Text>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">01 phòng · 05 hình khối · Nội dung mẫu</Text>
          {isSceneOpen && <Button variant="default" onClick={() => setIsSceneOpen(false)}>Dừng 3D</Button>}
        </Group>
        <div className={classes.viewport}>
          {isSceneOpen ? (
            <ErrorBoundary fallback={<SceneFallback />}>
              <Suspense fallback={<Stack h="100%" align="center" justify="center"><Text role="status">Đang mở phòng 3D…</Text></Stack>}>
                <LazyMuseumScene displays={SAMPLE_DISPLAYS} />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <Stack className={classes.intro} align="center" justify="center" p="xl" ta="center">
              <Text size="xs" tt="uppercase" fw={700}>Một góc nhìn khác về hình khối</Text>
              <Title order={2}>Bước vào phòng trưng bày</Title>
              <Text maw={420}>Khám phá năm nghiên cứu điêu khắc trong không gian kiến trúc và ánh sáng ấm.</Text>
              <Button color="teal" size="lg" onClick={() => setIsSceneOpen(true)}>Mở phòng 3D</Button>
              <Text size="sm">Bạn cũng có thể đọc toàn bộ nội dung ngay bên dưới.</Text>
            </Stack>
          )}
        </div>
        <Text id="museum-controls-help" size="sm" c="dimmed">
          Kéo chuột hoặc vuốt để xoay · Cuộn hoặc chụm hai ngón để thu phóng.
          Khi chọn khung 3D: phím mũi tên / WASD xoay góc nhìn, +/− thu phóng, Home về ban đầu. Tab để rời khung.
        </Text>
        <MuseumCatalogue displays={SAMPLE_DISPLAYS} />
      </Stack>
    </Container>
  );
}
