import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Container, Group, NativeSelect, Stack, Text, Title } from '@mantine/core';
import { useSearchParams } from 'react-router-dom';
import { MuseumCatalogue } from '@/components/museum/MuseumCatalogue';
import { ExhibitDetailPanel } from '@/components/museum/ExhibitDetailPanel';
import { useMuseumRooms } from '@/hooks/useMuseumRooms';
import { mapRoomDisplays } from '@/helpers/mapRoomDisplays';
import { EmptyState } from '@/shared/components/data/EmptyState';
import { SceneFallback } from '@/components/museum/SceneFallback';
import { ErrorBoundary } from '@/shared/components/feedback/ErrorBoundary';
import classes from './MuseumPage.module.css';

const LazyMuseumScene = lazy(() => import('@/components/MuseumScene').then((module) => ({ default: module.MuseumScene })));

export function MuseumPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { rooms, room, selectedRoom, selectedSlug, refresh } = useMuseumRooms(searchParams.get('room'));
  const detail = rooms.isSuccess && selectedRoom && room.isSuccess ? room.data : undefined;
  const displays = useMemo(() => detail ? mapRoomDisplays(detail) : [], [detail]);
  const [isSceneOpen, setIsSceneOpen] = useState(false);
  const [selection, setSelection] = useState<{ roomId: string; id: string } | null>(null);
  const selectedDisplay = detail && selection?.roomId === detail.id ? displays.find((display) => display.id === selection.id) : undefined;
  useEffect(() => setSelection(null), [selectedSlug]);
  const selectionTriggerRef = useRef<HTMLElement | null>(null);
  const handleSelectDisplay = (id: string) => {
    selectionTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (detail) setSelection({ roomId: detail.id, id });
  };
  const handleCloseDetail = () => {
    setSelection(null);
    if (selectionTriggerRef.current?.isConnected) selectionTriggerRef.current.focus({ preventScroll: true });
  };
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const wasSceneOpenRef = useRef(false);
  useEffect(() => {
    if (wasSceneOpenRef.current && !isSceneOpen) startButtonRef.current?.focus({ preventScroll: true });
    wasSceneOpenRef.current = isSceneOpen;
  }, [isSceneOpen]);
  const handleSelectRoom = (slug: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('room', slug);
    setSearchParams(next);
  };
  return (
    <Container size="xl" py="xl" onKeyDown={(event) => {
      if (event.key === 'Escape' && selectedDisplay) { event.preventDefault(); handleCloseDetail(); }
    }}>
      <Stack>
        <Text size="xs" tt="uppercase" c="dimmed" fw={700}>Aura / Tham quan bảo tàng</Text>
        <Title order={1}>{detail?.name ?? 'Tham quan bảo tàng'}</Title>
        <Text>Nội dung bảo tàng đã xuất bản</Text>
        <Group justify="space-between">
          {rooms.data && rooms.data.length > 0 && (
            <NativeSelect label="Chọn phòng trưng bày" value={selectedSlug ?? ''} onChange={(event) => handleSelectRoom(event.currentTarget.value)}
              data={[
                ...(!selectedRoom ? [{ value: selectedSlug ?? '', label: 'Phòng không khả dụng', disabled: true }] : []),
                ...rooms.data.map((item) => ({ value: item.slug, label: item.name })),
              ]} />
          )}
          <Button variant="default" disabled={rooms.isFetching || room.isFetching} onClick={() => void refresh()}>Làm mới</Button>
          {isSceneOpen && <Button variant="default" onClick={() => setIsSceneOpen(false)}>Dừng 3D</Button>}
        </Group>
        {rooms.isPending ? <Text role="status">Đang tải danh sách phòng…</Text>
          : rooms.isError ? <Alert color="red" role="alert" title="Không tải được danh sách phòng">
            <Text>{rooms.error.message}</Text><Button mt="sm" onClick={() => void rooms.refetch()}>Thử lại</Button>
          </Alert>
          : rooms.data.length === 0 ? <EmptyState text="Chưa có phòng trưng bày công khai." />
          : !selectedRoom ? <Alert role="alert" color="red">Phòng được chọn không có trong danh sách công khai. Hãy chọn phòng khác.</Alert>
          : room.isPending ? <Text role="status">Đang tải phòng trưng bày…</Text>
          : room.isError ? <Alert color="red" role="alert" title="Không tải được phòng trưng bày">
            <Text>{room.error.message}</Text><Button mt="sm" onClick={() => void room.refetch()}>Thử lại</Button>
          </Alert> : null}
        {detail && <>
        {detail.description && <Text>{detail.description}</Text>}
        <Text size="sm" c="dimmed">{displays.length} hiện vật · Hình khối thay thế cho ảnh hoặc mô hình chưa khả dụng</Text>
        {room.isFetching && <Text role="status">Đang cập nhật phòng…</Text>}
        <div className={`${classes.stage} ${selectedDisplay ? classes.stageDetails : ''}`}>
        <div className={classes.viewport}>
          {isSceneOpen ? (
            <ErrorBoundary key={detail.id} fallback={<SceneFallback />}>
              <Suspense fallback={<Stack h="100%" align="center" justify="center"><Text role="status">Đang mở phòng 3D…</Text></Stack>}>
                <LazyMuseumScene displays={displays} selectedId={selectedDisplay?.id ?? null} onSelect={handleSelectDisplay} />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <Stack className={classes.intro} align="center" justify="center" p="xl" ta="center">
              <Title order={2}>Bước vào phòng trưng bày</Title>
              <Text maw={420}>Khám phá {detail.name} trong không gian 3D.</Text>
              <Button ref={startButtonRef} color="teal" size="lg" onClick={() => setIsSceneOpen(true)}>Mở phòng 3D</Button>
              <Text size="sm">Bạn cũng có thể đọc toàn bộ nội dung ngay bên dưới.</Text>
            </Stack>
          )}
        </div>
        {selectedDisplay && <ExhibitDetailPanel display={selectedDisplay} onClose={handleCloseDetail} />}
        </div>
        <Text id="museum-controls-help" size="sm" c="dimmed">
          Kéo chuột hoặc vuốt để xoay · Cuộn hoặc chụm hai ngón để thu phóng.
          Khi chọn khung 3D: phím mũi tên / WASD xoay góc nhìn, +/− thu phóng, Home về ban đầu. Tab để rời khung.
        </Text>
        <MuseumCatalogue displays={displays} selectedId={selectedDisplay?.id ?? null} onSelect={handleSelectDisplay} />
        </>}
      </Stack>
    </Container>
  );
}
