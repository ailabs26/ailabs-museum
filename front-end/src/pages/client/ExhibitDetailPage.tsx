import { Button, Container, Title } from '@mantine/core';
import { usePublicLocale } from '@/core/i18n/public-locale';
import { localizeExhibit } from '@/helpers/localizeExhibit';
import { IconCube } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import { MediaCreditList } from '@/components/museum/MediaCreditList';
import { collectMediaCredits } from '@/helpers/mediaCredits';
import { useMuseumRooms } from '@/hooks/useMuseumRooms';
import { ExhibitImage } from '@/shared/components/media/ExhibitImage';
import { AudioPlayer } from '@/shared/components/media/AudioPlayer';
import { PublicReportModal } from '@/shared/components/feedback/PublicReportModal';
import { favoritesStore, readingStore, recentStore, rememberExhibit } from '@/helpers/visitorState';
import { useVisitorStore } from '@/hooks/useVisitorStore';
import { FavoriteButton } from './visitor/FavoriteButton';
import { VisitorStorageStatus } from './visitor/VisitorStorageStatus';
import { ReadingControls } from './visitor/ReadingControls';
import { VisitorNotes } from './visitor/VisitorNotes';
import classes from './ExhibitDetailPage.module.css';

export function ExhibitDetailPage() {
  const { locale, t } = usePublicLocale();
  const [isReportOpen, setIsReportOpen] = useState(false);
  const favorites = useVisitorStore(favoritesStore);
  const reading = useVisitorStore(readingStore);
  const { roomSlug, exhibitId } = useParams<{ roomSlug: string; exhibitId: string }>();
  const { rooms, room, selectedRoom } = useMuseumRooms(roomSlug ?? '');
  const isValidId = z.string().uuid().safeParse(exhibitId).success;
  const detail = rooms.isSuccess && selectedRoom && room.isSuccess ? room.data : undefined;
  const found = detail && isValidId ? detail.exhibits.find((item) => item.id === exhibitId) : undefined;
  const exhibit = found ? localizeExhibit(found, locale) : undefined;
  const viewedRef = useRef<string | null>(null);
  const validRoomId = exhibit?.roomId;
  const validExhibitId = exhibit?.id;
  const canRecordView = rooms.isSuccess && !rooms.isFetching && room.isSuccess && !room.isFetching;
  useEffect(() => {
    if (!canRecordView || !validRoomId || !validExhibitId) return;
    const key = `${validRoomId}:${validExhibitId}`;
    if (viewedRef.current === key) return;
    viewedRef.current = key;
    recentStore.update(refs => rememberExhibit(refs, { roomId: validRoomId, exhibitId: validExhibitId }));
  }, [canRecordView, validRoomId, validExhibitId]);
  const credits = exhibit ? collectMediaCredits(exhibit) : [];
  const audio = exhibit?.audio?.vi;
  const transcript = audio?.transcript ?? (exhibit?.i18n ? exhibit.i18n.vi.transcript : exhibit?.transcript);

  let statusTitle: string | undefined;
  let statusMessage: string | undefined;
  let isLoading = false;
  let isError = false;
  if (!isValidId) {
    statusTitle = t('ui.detail.error.invalid.title', 'Đường dẫn hiện vật không hợp lệ');
    statusMessage = t('ui.detail.error.invalid.message', 'Mã hiện vật trong đường dẫn không đúng định dạng.');
  } else if (rooms.isPending) {
    statusTitle = t('ui.detail.loading.title', 'Chi tiết hiện vật');
    statusMessage = t('ui.detail.loading.rooms', 'Đang tải danh sách phòng…');
    isLoading = true;
  } else if (rooms.isError) {
    statusTitle = t('ui.detail.error.load', 'Không tải được nội dung');
    statusMessage = rooms.error.message;
    isError = true;
  } else if (!selectedRoom) {
    statusTitle = t('ui.detail.error.room.title', 'Không tìm thấy phòng trưng bày');
    statusMessage = t('ui.detail.error.room.message', 'Phòng trong đường dẫn không có trong danh sách công khai.');
  } else if (room.isPending) {
    statusTitle = t('ui.detail.loading.title', 'Chi tiết hiện vật');
    statusMessage = t('ui.detail.loading.exhibit', 'Đang tải hiện vật…');
    isLoading = true;
  } else if (room.isError) {
    statusTitle = t('ui.detail.error.load', 'Không tải được nội dung');
    statusMessage = room.error.message;
    isError = true;
  } else if (!exhibit) {
    statusTitle = t('ui.detail.error.exhibit.title', 'Không tìm thấy hiện vật');
    statusMessage = t('ui.detail.error.exhibit.message', 'Hiện vật không có trong bộ sưu tập công khai của phòng này.');
  }

  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!isLoading) titleRef.current?.focus();
  }, [roomSlug, exhibitId, statusTitle, isLoading]);

  return (
    <Container size="lg" className={classes.page}>
      {statusTitle ? <>
        <Title ref={titleRef} tabIndex={-1} order={1} className={classes.title}>{statusTitle}</Title>
        <p role={isError ? 'alert' : isLoading ? 'status' : undefined} className={classes.body}>{statusMessage}</p>
        {isError && <Button mt="md" onClick={() => void (rooms.isError ? rooms.refetch() : room.refetch())}>{t('ui.detail.retry', 'Thử lại')}</Button>}
        {!isLoading && <p><Link to="/collection">{t('ui.detail.back-to-collection', 'Về bộ sưu tập')}</Link></p>}
      </> : detail && exhibit ? <article aria-labelledby="exhibit-title">
        <Link className={classes.backLink} to={`/collection?${new URLSearchParams({ room: detail.slug })}`}>{t('ui.detail.back', 'Quay lại bộ sưu tập của phòng này')}</Link>
        <header className={classes.header}>
          <p className={classes.roomName}>{detail.name}</p>
          <Title ref={titleRef} tabIndex={-1} order={1} id="exhibit-title" className={classes.title}>{exhibit.name}</Title>
          <div className={classes.headerActions}>
            <Link className={classes.jump3d}
              to={`/tour?${new URLSearchParams({ room: detail.slug, exhibit: exhibit.id })}`}>
              <IconCube size={18} aria-hidden="true" /> {t('ui.detail.tour', 'Xem trong không gian 3D')}
            </Link>
            <Button variant="default" onClick={() => setIsReportOpen(true)}>{t('ui.detail.report', 'Báo nội dung')}</Button>
            <FavoriteButton target={{ roomId: detail.id, exhibitId: exhibit.id }} name={exhibit.name} />
          </div>
          <VisitorStorageStatus error={favorites.error} />
        </header>
        <ReadingControls />
        <div className={`${classes.content} ${reading.value.enabled ? classes.reading : ''}`}
          style={{ '--reading-scale': reading.value.fontScale } as CSSProperties}>
          <ExhibitImage image={exhibit.image ? { url: exhibit.image.url, alt: exhibit.image.altText.vi || exhibit.name } : null}
            shape={exhibit.placeholderShape} color={exhibit.placeholderColor} className={classes.preview} />
          <div className={classes.sections}>
            <div className={classes.audioDock}>
              <AudioPlayer key={`${detail.id}:${exhibit.id}:vi`} src={audio?.audio.url} label={t('ui.audio.label', 'Thuyết minh audio')}
                subtitleUrl={audio?.subtitle?.url} locale="vi" translate={t} />
            </div>
            <section aria-labelledby="exhibit-description-title">
              <Title order={2} id="exhibit-description-title" className={classes.sectionTitle}>{t('ui.detail.section.story', 'Câu chuyện hiện vật')}</Title>
              <p className={classes.body}>{exhibit.description || t('ui.detail.description.empty', 'Chưa có mô tả.')}</p>
            </section>
            {transcript && <section aria-labelledby="exhibit-transcript-title">
              <Title order={2} id="exhibit-transcript-title" className={classes.sectionTitle}>{t('ui.detail.section.transcript', 'Bản thuyết minh')}</Title>
              <p className={classes.body}>{transcript}</p>
            </section>}
            {exhibit.hotspots.length > 0 && <section aria-labelledby="exhibit-hotspots-title">
              <Title order={2} id="exhibit-hotspots-title" className={classes.sectionTitle}>{t('ui.detail.section.hotspots', 'Điểm chú ý')}</Title>
              <ul className={classes.hotspots} aria-label={t('ui.detail.section.hotspots.aria', 'Điểm chú ý của hiện vật')}>
                {[...exhibit.hotspots].sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id))
                  .map((hotspot) => <li key={hotspot.id}>
                    <p className={classes.hotspotLabel}>{hotspot.label}</p>
                    <p className={classes.body}>{hotspot.body}</p>
                  </li>)}
              </ul>
            </section>}
            {credits.length > 0 && <section aria-labelledby="exhibit-credits-title">
              <Title order={2} id="exhibit-credits-title" className={classes.sectionTitle}>{t('ui.detail.section.credits', 'Nguồn & bản quyền')}</Title>
              <MediaCreditList credits={credits} className={classes.body} />
            </section>}
          </div>
        </div>
        <VisitorNotes key={`${detail.id}:${exhibit.id}`} target={{ roomId: detail.id, exhibitId: exhibit.id }} />
      </article> : null}
      {exhibit && isReportOpen && <PublicReportModal key={`${exhibit.id}:${exhibit.revisionId}`} exhibitId={exhibit.id}
        reportedRevisionId={exhibit.revisionId} opened onClose={() => setIsReportOpen(false)} translate={t} />}
    </Container>
  );
}
