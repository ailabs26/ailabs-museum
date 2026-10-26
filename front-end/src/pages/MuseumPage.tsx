import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Container, Group, NativeSelect, Stack, Text, Title } from '@mantine/core';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { PublicReportModal } from '@/shared/components/feedback/PublicReportModal';
import { MuseumCatalogue } from '@/components/museum/MuseumCatalogue';
import { ExhibitDetailPanel } from '@/components/museum/ExhibitDetailPanel';
import { MuseumLoading } from '@/components/museum/MuseumLoading';
import { useMuseumRooms } from '@/hooks/useMuseumRooms';
import { mapRoomDisplays } from '@/helpers/mapRoomDisplays';
import { EmptyState } from '@/shared/components/data/EmptyState';
import { SceneFallback } from '@/components/museum/SceneFallback';
import { ErrorBoundary } from '@/shared/components/feedback/ErrorBoundary';
import { ImmersiveTour } from '@/components/museum/ImmersiveTour';
import { useImmersiveTour } from '@/hooks/useImmersiveTour';
import type { XrSessionController, XrSnapshot } from '@/helpers/xrSession';
import classes from './MuseumPage.module.css';

const LazyMuseumScene = lazy(() => import('@/components/MuseumScene').then((module) => ({ default: module.MuseumScene })));
const exhibitIdSchema = z.string().uuid();

export function MuseumPage() {
  const [reportTarget, setReportTarget] = useState<{ exhibitId: string; reportedRevisionId: string } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { rooms, room, selectedRoom, selectedSlug, refresh } = useMuseumRooms(searchParams.get('room'));
  const detail = rooms.isSuccess && selectedRoom && room.isSuccess ? room.data : undefined;
  const displays = useMemo(() => detail ? mapRoomDisplays(detail) : [], [detail]);
  const requestedExhibitId = searchParams.get('exhibit');
  const isRequestedExhibitValid = requestedExhibitId !== null && exhibitIdSchema.safeParse(requestedExhibitId).success;
  const { isOpen: isSceneOpen, containerRef, isXrPresentingRef, open: openScene, close: closeScene } = useImmersiveTour();
  const xrOwnerRef = useRef<XrSessionController | null>(null);
  const handleXrChange = useCallback((snapshot: XrSnapshot, owner: XrSessionController | null) => {
    isXrPresentingRef.current = snapshot.phase !== 'idle';
    xrOwnerRef.current = owner;
  }, [isXrPresentingRef]);
  const [failedRoomId, setFailedRoomId] = useState<string | null>(null);
  const [sceneAttempt, setSceneAttempt] = useState(0);
  const handleRetry3d = () => {
    if (sceneAttempt >= 2) return;
    setSceneAttempt(attempt => attempt + 1); setFailedRoomId(null); openScene();
  };
  const currentRoomId = detail?.id;
  const handleUnavailable = useCallback(() => {
    if (currentRoomId) setFailedRoomId(currentRoomId);
    closeScene();
  }, [currentRoomId, closeScene]);
  const selectedDisplay = detail && isRequestedExhibitValid
    ? displays.find((display) => display.id === requestedExhibitId)
    : undefined;
  const exhibitLinkMessage = detail && requestedExhibitId !== null && !selectedDisplay
    ? isRequestedExhibitValid ? 'Không tìm thấy hiện vật trong phòng này.' : 'Mã hiện vật trong đường dẫn không hợp lệ.'
    : null;
  const selectedReportTarget = selectedDisplay?.revisionId ? {
    exhibitId: selectedDisplay.id,
    reportedRevisionId: selectedDisplay.revisionId,
  } : null;
  const selectionTriggerRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const handleSelectDisplay = (id: string) => {
    if (!detail || !displays.some((display) => display.id === id)) return;
    selectionTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    containerRef.current?.querySelector('details[data-catalogue]')?.removeAttribute('open');
    const next = new URLSearchParams(searchParams);
    next.set('exhibit', id);
    setSearchParams(next, { replace: true });
  };
  const handleCloseDetail = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('exhibit');
    setSearchParams(next, { replace: true });
    if (selectionTriggerRef.current?.isConnected) selectionTriggerRef.current.focus();
    else if (isSceneOpen) containerRef.current?.querySelector('canvas')?.focus({ preventScroll: true });
    else (startButtonRef.current ?? headingRef.current)?.focus({ preventScroll: true });
  };
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const wasSceneOpenRef = useRef(false);
  useEffect(() => {
    if (wasSceneOpenRef.current && !isSceneOpen && failedRoomId !== currentRoomId) {
      // The readable detail panel mounts on exit and focuses its title first.
      // Restore the user's opener after those panel effects have completed.
      const frame = requestAnimationFrame(() => startButtonRef.current?.focus({ preventScroll: true }));
      wasSceneOpenRef.current = isSceneOpen;
      return () => cancelAnimationFrame(frame);
    }
    wasSceneOpenRef.current = isSceneOpen;
  }, [isSceneOpen, failedRoomId, currentRoomId]);
  const handleSelectRoom = (slug: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('room', slug);
    next.delete('exhibit');
    setSearchParams(next);
  };
  const read2dHref = detail ? selectedDisplay
    ? `/collection/${encodeURIComponent(detail.slug)}/exhibits/${encodeURIComponent(selectedDisplay.id)}`
    : `/collection?${new URLSearchParams({ room: detail.slug })}` : '/collection';
  const sceneFallback = <SceneFallback read2dHref={read2dHref} onUnavailable={handleUnavailable} onRetry={handleRetry3d} retriesRemaining={2 - sceneAttempt} />;
  const detailPanel = selectedDisplay && detail && <ExhibitDetailPanel display={selectedDisplay} onClose={handleCloseDetail}
    detail2dHref={`/collection/${encodeURIComponent(detail.slug)}/exhibits/${encodeURIComponent(selectedDisplay.id)}`}
    onReport={selectedReportTarget ? () => setReportTarget(selectedReportTarget) : undefined} />;
  const catalogue = <MuseumCatalogue displays={displays} selectedId={selectedDisplay?.id ?? null} onSelect={handleSelectDisplay} />;
  const reportModal = reportTarget && <PublicReportModal key={`${reportTarget.exhibitId}:${reportTarget.reportedRevisionId}`}
    {...reportTarget} opened onClose={() => setReportTarget(null)} portalTarget={isSceneOpen ? containerRef.current ?? undefined : undefined} />;
  return (
    <Container size="xl" py="xl" className={classes.page} onKeyDown={(event) => {
      if (!isSceneOpen && !reportTarget && event.key === 'Escape' && selectedDisplay) { event.preventDefault(); handleCloseDetail(); }
    }}>
      <Stack>
        <Text size="xs" tt="uppercase" className={classes.eyebrow} fw={700}>Aura / Tham quan bảo tàng</Text>
        <Title ref={headingRef} tabIndex={-1} order={1} className={classes.heading}>{detail?.name ?? 'Tham quan bảo tàng'}</Title>
        <Text className={classes.lead}>Nội dung bảo tàng đã xuất bản</Text>
        <Group justify="space-between" align="flex-end" className={classes.toolbar}>
          {rooms.data && rooms.data.length > 0 && (
            <NativeSelect className={classes.roomSelect} label={isSceneOpen ? 'Phòng trưng bày (trang)' : 'Chọn phòng trưng bày'} value={selectedSlug ?? ''} onChange={(event) => handleSelectRoom(event.currentTarget.value)}
              data={[
                ...(!selectedRoom ? [{ value: selectedSlug ?? '', label: 'Phòng không khả dụng', disabled: true }] : []),
                ...rooms.data.map((item) => ({ value: item.slug, label: item.name })),
              ]} />
          )}
          <Group gap="sm">
            <Button variant="default" disabled={rooms.isFetching || room.isFetching} onClick={() => void refresh()}>Làm mới</Button>
          </Group>
        </Group>
        {rooms.isPending ? <MuseumLoading text="Đang tải danh sách phòng…" />
          : rooms.isError ? <Alert color="red" role="alert" title="Không tải được danh sách phòng">
            <Text>{rooms.error.message}</Text><Button mt="sm" onClick={() => void rooms.refetch()}>Thử lại</Button>
          </Alert>
          : rooms.data.length === 0 ? <EmptyState text="Chưa có phòng trưng bày công khai." />
          : !selectedRoom ? <Alert role="alert" color="red">Phòng được chọn không có trong danh sách công khai. Hãy chọn phòng khác.</Alert>
          : room.isPending ? <MuseumLoading text="Đang tải phòng trưng bày…" />
          : room.isError ? <Alert color="red" role="alert" title="Không tải được phòng trưng bày">
            <Text>{room.error.message}</Text><Button mt="sm" onClick={() => void room.refetch()}>Thử lại</Button>
          </Alert> : null}
        {detail && <>
        {detail.description && <Text>{detail.description}</Text>}
        <Text size="sm" c="dimmed">{displays.length} hiện vật · {displays.some(display => display.model) ? 'Mở phòng 3D để khám phá mô hình hiện vật' : 'Hình khối thay thế cho ảnh hoặc mô hình chưa khả dụng'}</Text>
        {exhibitLinkMessage && <Text role="status">{exhibitLinkMessage}</Text>}
        {room.isFetching && <Text role="status">Đang cập nhật phòng…</Text>}
        <div className={`${classes.stage} ${selectedDisplay ? classes.stageDetails : ''}`}>
        <div className={classes.viewport}>
          {failedRoomId === detail.id ? sceneFallback : (
            <Stack className={classes.intro} align="center" justify="center" p="xl" ta="center">
              <Text className={classes.eyebrow} size="xs" fw={700}>KHÔNG GIAN KHÁM PHÁ</Text>
              <Title order={2} className={classes.introTitle}>Bước vào phòng trưng bày</Title>
              <Text maw={420}>Khám phá {detail.name} trong không gian 3D.</Text>
              <Button ref={startButtonRef} color="teal.9" size="lg" onClick={openScene}>Mở phòng 3D</Button>
              <Text size="sm">Bạn cũng có thể đọc toàn bộ nội dung ngay bên dưới.</Text>
            </Stack>
          )}
        </div>
        {!isSceneOpen && detailPanel}
        </div>
        <Text id={isSceneOpen ? undefined : 'museum-controls-help'} size="sm" c="dimmed">
          Giữ và kéo chuột hoặc vuốt để nhìn · Joystick trái để đi trên thiết bị cảm ứng.
          Chọn hiện vật để xem chi tiết. Khi chọn khung 3D: WASD di chuyển, Shift đi nhanh, mũi tên xoay, +/− đến gần/lùi xa,
          F tập trung hiện vật đã chọn, Home về ban đầu. Escape đóng chi tiết · Tab để rời khung.
        </Text>
        <div style={{ visibility: isSceneOpen ? 'hidden' : undefined }} aria-hidden={isSceneOpen || undefined}>
          <MuseumCatalogue displays={displays} selectedId={selectedDisplay?.id ?? null} onSelect={handleSelectDisplay} idPrefix={isSceneOpen ? 'background-' : ''} />
        </div>
        </>}
      </Stack>
      {isSceneOpen && detail && <ImmersiveTour containerRef={containerRef} roomName={detail.name} hasModal={!!reportTarget}
        onClose={() => { setReportTarget(null); closeScene(); }} onEscape={() => {
          if (isXrPresentingRef.current) { void xrOwnerRef.current?.exit(); return; }
          if (selectedDisplay) handleCloseDetail(); else closeScene();
        }}>
        <ErrorBoundary key={`${detail.id}:${sceneAttempt}`} fallback={sceneFallback}>
          <Suspense fallback={<MuseumLoading text="Đang mở phòng 3D…" />}>
            <LazyMuseumScene displays={displays} selectedId={selectedDisplay?.id ?? null} onSelect={handleSelectDisplay}
              onClear={handleCloseDetail} fallback={sceneFallback} immersive onXrChange={handleXrChange} />
          </Suspense>
        </ErrorBoundary>
        <div className={classes.immersiveRoomSelect}>
          <NativeSelect aria-label="Chọn phòng trưng bày" value={selectedSlug ?? ''}
            onChange={event => handleSelectRoom(event.currentTarget.value)} data={rooms.data?.map(item => ({ value: item.slug, label: item.name })) ?? []} />
        </div>
        <div className={classes.immersiveDetail}>{detailPanel}</div>
        <details data-catalogue className={classes.immersiveCatalogue}><summary>Danh mục hiện vật</summary>{catalogue}</details>
        <p id="museum-controls-help" className={classes.srOnly}>WASD di chuyển, kéo chuột hoặc vuốt để nhìn, F tập trung, Home đặt lại. Escape đóng chi tiết rồi thoát tham quan.</p>
        {reportModal}
      </ImmersiveTour>}
      {!isSceneOpen && reportModal}
    </Container>
  );
}
