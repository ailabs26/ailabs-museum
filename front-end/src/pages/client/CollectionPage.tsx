import { Alert, Button, Checkbox, Container, Text, TextInput, Title, VisuallyHidden } from '@mantine/core';
import { IconArrowRight, IconSearch } from '@tabler/icons-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMuseumRooms } from '@/hooks/useMuseumRooms';
import { ExhibitGrid } from '@/shared/components/data/ExhibitGrid';
import { ExhibitSkeleton } from '@/shared/components/feedback/ExhibitSkeleton';
import { PublicReportModal } from '@/shared/components/feedback/PublicReportModal';
import { favoritesStore, isSameExhibit } from '@/helpers/visitorState';
import { useVisitorStore } from '@/hooks/useVisitorStore';
import { FavoriteButton } from './visitor/FavoriteButton';
import { VisitorStorageStatus } from './visitor/VisitorStorageStatus';
import classes from './CollectionPage.module.css';

export function CollectionPage() {
  const [reportTarget, setReportTarget] = useState<{ exhibitId: string; reportedRevisionId: string } | null>(null);
  const [query, setQuery] = useState('');
  const [isFavoritesOnly, setIsFavoritesOnly] = useState(false);
  const favorites = useVisitorStore(favoritesStore);
  const [loadingAnnouncement, setLoadingAnnouncement] = useState('');
  const location = useLocation();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const focusedLocation = useRef<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { rooms, room, selectedRoom, selectedSlug, refresh } = useMuseumRooms(searchParams.get('room'));
  const loadingMessage = rooms.isPending
    ? 'Đang tải danh sách phòng trưng bày…'
    : selectedRoom && room.isPending
      ? `Đang tải hiện vật của phòng ${selectedRoom.name}…`
      : '';
  useEffect(() => {
    setLoadingAnnouncement(loadingMessage);
  }, [loadingMessage]);
  const detail = rooms.isSuccess && selectedRoom && room.isSuccess ? room.data : undefined;
  const exhibits = detail ? [...detail.exhibits].sort((left, right) =>
    left.displayOrder - right.displayOrder || left.id.localeCompare(right.id)) : [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exhibits.filter((e) => (!q || `${e.name} ${e.description}`.toLowerCase().includes(q))
      && (!isFavoritesOnly || favorites.value.some(ref => isSameExhibit(ref, { roomId: e.roomId, exhibitId: e.id }))));
  }, [exhibits, query, isFavoritesOnly, favorites.value]);
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
    setQuery('');
  };

  return (
    <Container size="lg" className={classes.page}>
      <VisuallyHidden role="status" aria-live="polite" aria-atomic="true" aria-label="Trạng thái tải bộ sưu tập">
        {loadingAnnouncement}
      </VisuallyHidden>
      <header className={classes.intro}>
        <p className={classes.eyebrow}>Aura Museum / Khám phá hiện vật</p>
        <Title ref={titleRef} tabIndex={-1} order={1} className={classes.title}>Bộ sưu tập</Title>
        <p className={classes.description}>Dành một chút thời gian cho mỗi câu chuyện.
          Khám phá nội dung hiện vật trong giao diện 2D, không cần mở không gian 3D.</p>
      </header>

      {/* Filter pills + live search */}
      {rooms.data && rooms.data.length > 0 && (
        <div className={classes.toolbar}>
          <div className={classes.pills} role="group" aria-label="Chọn phòng trưng bày">
            {!selectedRoom && selectedSlug && (
              <span className={`${classes.pill} ${classes.pillActive}`}>Phòng không khả dụng</span>
            )}
            {rooms.data.map((item) => (
              <button key={item.slug} type="button"
                className={`${classes.pill} ${item.slug === selectedSlug ? classes.pillActive : ''}`}
                aria-pressed={item.slug === selectedSlug}
                onClick={() => handleSelectRoom(item.slug)}>{item.name}</button>
            ))}
          </div>
          <div className={classes.toolbarRight}>
            <TextInput className={classes.search} value={query} onChange={(e) => setQuery(e.currentTarget.value)}
              placeholder="Tìm hiện vật theo tên hoặc từ khóa…" aria-label="Tìm kiếm hiện vật"
              leftSection={<IconSearch size={16} aria-hidden="true" />} />
            <Button variant="default" disabled={rooms.isFetching || room.isFetching}
              onClick={() => void refresh()}>Làm mới</Button>
          </div>
        </div>
      )}

      <Checkbox my="md" label="Chỉ hiện vật yêu thích trong phòng này" checked={isFavoritesOnly}
        onChange={event => setIsFavoritesOnly(event.currentTarget.checked)} />
      <VisitorStorageStatus error={favorites.error} />

      {rooms.isPending ? <ExhibitSkeleton />
        : rooms.isError ? <Alert color="red" role="alert" title="Không tải được danh sách phòng">
          <Text>{rooms.error.message}</Text>
          <Button mt="sm" onClick={() => void rooms.refetch()}>Thử lại</Button>
        </Alert>
        : rooms.data.length === 0 ? <p role="status" className={classes.empty}>Chưa có phòng trưng bày công khai.</p>
        : !selectedRoom ? <Alert color="red" role="alert">Phòng được chọn không có trong danh sách công khai. Hãy chọn phòng khác.</Alert>
        : room.isPending ? <ExhibitSkeleton />
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
              <p className={classes.count}>
                {query.trim() ? `${filtered.length}/${exhibits.length}` : exhibits.length} hiện vật
                {query.trim() ? ' khớp tìm kiếm' : ' đã xuất bản'}
              </p>
            </div>
            <Link to={`/tour?${new URLSearchParams({ room: detail.slug })}`} className={classes.tourLink}>
              Tham quan phòng này trong 3D <IconArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
          {room.isFetching && <p role="status">Đang cập nhật hiện vật…</p>}
          {exhibits.length === 0 ? <p role="status" className={classes.empty}>Phòng này chưa có hiện vật được xuất bản.</p>
            : filtered.length === 0 ? <p role="status" className={classes.empty}>{isFavoritesOnly
              ? 'Không có hiện vật yêu thích khớp trong phòng này. Hãy đánh dấu yêu thích hoặc thay đổi tìm kiếm.'
              : `Không có hiện vật nào khớp với “${query}”.`}</p> : (
            <ExhibitGrid exhibits={filtered} roomSlug={detail.slug} onReport={(exhibit) =>
              setReportTarget({ exhibitId: exhibit.id, reportedRevisionId: exhibit.revisionId })}
              renderActions={exhibit => <FavoriteButton target={{ roomId: detail.id, exhibitId: exhibit.id }} name={exhibit.name} />} />
          )}
        </section>
      )}
      {reportTarget && <PublicReportModal key={`${reportTarget.exhibitId}:${reportTarget.reportedRevisionId}`}
        {...reportTarget} opened onClose={() => setReportTarget(null)} />}
    </Container>
  );
}
