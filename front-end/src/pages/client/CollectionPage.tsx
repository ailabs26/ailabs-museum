import { Alert, Button, Container, NativeSelect, Text, Title } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useMuseumRooms } from '@/hooks/useMuseumRooms';
import { ExhibitGrid } from '@/shared/components/data/ExhibitGrid';
import { PublicReportModal } from '@/shared/components/feedback/PublicReportModal';
import classes from './CollectionPage.module.css';

export function CollectionPage() {
  const [reportTarget, setReportTarget] = useState<{ exhibitId: string; reportedRevisionId: string } | null>(null);
  const location = useLocation();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const focusedLocation = useRef<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { rooms, room, selectedRoom, selectedSlug, refresh } = useMuseumRooms(searchParams.get('room'));
  const detail = rooms.isSuccess && selectedRoom && room.isSuccess ? room.data : undefined;
  const exhibits = detail ? [...detail.exhibits].sort((left, right) =>
    left.displayOrder - right.displayOrder || left.id.localeCompare(right.id)) : [];
  const destinationReady = !rooms.isPending && (!selectedRoom || !room.isPending);
  const fromTourFallback = location.state?.fromTourFallback === true;
  useEffect(() => {
    if (fromTourFallback && destinationReady && focusedLocation.current !== location.key) {
      titleRef.current?.focus();
      focusedLocation.current = location.key;
    }
  }, [fromTourFallback, destinationReady, location.key]);
  const handleSelectRoom = (slug: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('room', slug);
    setSearchParams(next);
  };

  return (
    <Container size="lg" className={classes.page}>
      <header className={classes.intro}>
        <p className={classes.eyebrow}>Aura Museum / Khám phá hiện vật</p>
        <Title ref={titleRef} tabIndex={-1} order={1} className={classes.title}>Bộ sưu tập</Title>
        <p className={classes.description}>Dành một chút thời gian cho mỗi câu chuyện.
          Khám phá nội dung hiện vật trong giao diện 2D, không cần mở không gian 3D.</p>
      </header>

      <div className={classes.toolbar}>
        {rooms.data && rooms.data.length > 0 && (
          <NativeSelect label="Chọn phòng trưng bày" value={selectedSlug ?? ''}
            className={classes.select} onChange={(event) => handleSelectRoom(event.currentTarget.value)}
            data={[
              ...(!selectedRoom ? [{ value: selectedSlug ?? '', label: 'Phòng không khả dụng', disabled: true }] : []),
              ...rooms.data.map((item) => ({ value: item.slug, label: item.name })),
            ]} />
        )}
        <Button variant="default" disabled={rooms.isFetching || room.isFetching}
          onClick={() => void refresh()}>Làm mới</Button>
      </div>

      {rooms.isPending ? <p role="status">Đang tải danh sách phòng…</p>
        : rooms.isError ? <Alert color="red" role="alert" title="Không tải được danh sách phòng">
          <Text>{rooms.error.message}</Text>
          <Button mt="sm" onClick={() => void rooms.refetch()}>Thử lại</Button>
        </Alert>
        : rooms.data.length === 0 ? <p role="status" className={classes.empty}>Chưa có phòng trưng bày công khai.</p>
        : !selectedRoom ? <Alert color="red" role="alert">Phòng được chọn không có trong danh sách công khai. Hãy chọn phòng khác.</Alert>
        : room.isPending ? <p role="status">Đang tải hiện vật…</p>
        : room.isError ? <Alert color="red" role="alert" title="Không tải được hiện vật">
          <Text>{room.error.message}</Text>
          <Button mt="sm" onClick={() => void room.refetch()}>Thử lại</Button>
        </Alert> : null}

      {detail && (
        <section aria-labelledby="collection-room-title">
          <div className={classes.roomHeader}>
            <div>
              <Title order={2} id="collection-room-title" className={classes.roomTitle}>{detail.name}</Title>
              {detail.description && <p className={classes.roomDescription}>{detail.description}</p>}
              <p className={classes.count}>{exhibits.length} hiện vật đã xuất bản</p>
            </div>
            <Link to={`/tour?${new URLSearchParams({ room: detail.slug })}`} className={classes.tourLink}>
              Tham quan phòng này trong 3D <IconArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
          {room.isFetching && <p role="status">Đang cập nhật hiện vật…</p>}
          {exhibits.length === 0 ? <p role="status" className={classes.empty}>Phòng này chưa có hiện vật được xuất bản.</p> : (
            <ExhibitGrid exhibits={exhibits} roomSlug={detail.slug} onReport={(exhibit) =>
              setReportTarget({ exhibitId: exhibit.id, reportedRevisionId: exhibit.revisionId })} />
          )}
        </section>
      )}
      {reportTarget && <PublicReportModal key={`${reportTarget.exhibitId}:${reportTarget.reportedRevisionId}`}
        {...reportTarget} opened onClose={() => setReportTarget(null)} />}
    </Container>
  );
}
