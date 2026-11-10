import { Button, Container, Title } from '@mantine/core';
import { usePublicErrorText, usePublicLocale } from '@/core/i18n/public-locale';
import { hasTranslation, localizedAltText, localizedTranscript, localizeExhibit } from '@/helpers/localizeExhibit';
import { IconCube } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import { MediaCreditList } from '@/components/museum/MediaCreditList';
import { GuidedTour2DControls } from '@/components/museum/GuidedTour2DControls';
import { collectMediaCredits } from '@/helpers/mediaCredits';
import { GUIDED_TOUR_2D_MESSAGES } from '@/helpers/guidedTour2dMessages';
import { useMuseumRooms } from '@/hooks/useMuseumRooms';
import { useGuidedTour2D } from '@/hooks/useGuidedTour2D';
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
import { usePageTitle } from '@/hooks/usePageTitle';

export function ExhibitDetailPage() {
  const { locale, t } = usePublicLocale();
  const tourMessages = GUIDED_TOUR_2D_MESSAGES[locale as keyof typeof GUIDED_TOUR_2D_MESSAGES]
    ?? GUIDED_TOUR_2D_MESSAGES.vi;
  const errorText = usePublicErrorText();
  const [isReportOpen, setIsReportOpen] = useState(false);
  const favorites = useVisitorStore(favoritesStore);
  const reading = useVisitorStore(readingStore);
  const { roomSlug, exhibitId } = useParams<{ roomSlug: string; exhibitId: string }>();
  const { rooms, room, selectedRoom } = useMuseumRooms(roomSlug ?? '');
  const isValidId = z.string().uuid().safeParse(exhibitId).success;
  const detail = rooms.isSuccess && selectedRoom && room.isSuccess ? room.data : undefined;
  const found = detail && isValidId ? detail.exhibits.find((item) => item.id === exhibitId) : undefined;
  const exhibit = found ? localizeExhibit(found, locale) : undefined;
  const tour2d = useGuidedTour2D({
    room: detail && !room.isError ? detail : undefined,
    publicRooms: rooms.isSuccess && !rooms.isError && !rooms.isFetching ? rooms.data : undefined,
    route: selectedRoom ? { roomId: selectedRoom.id, exhibitId: exhibitId ?? null } : undefined,
  });
  const tourStepExhibit = detail?.exhibits.find((item) => item.id === tour2d.currentStep?.exhibitId);
  const recovery = tour2d.isSameRoom && !tour2d.isCurrentRoute && tour2d.currentStep ? (
    <section className={classes.tourRecovery} aria-label={t('ui.guided2d.recovery-label', tourMessages.recoveryLabel)}>
      <p role="status">{t('ui.guided2d.route-drift', tourMessages.routeDrift, {
        exhibit: tourStepExhibit?.name ?? tour2d.currentStep.exhibitId,
      })}</p>
      <div className={classes.headerActions}>
        <Button color="teal.9" onClick={() => tour2d.continueToCurrent(detail)}>
          {t('ui.guided2d.return', tourMessages.returnToStep)}
        </Button>
        <Button variant="default" onClick={tour2d.exit}>{t('ui.guided.exit', 'Thoát hướng dẫn')}</Button>
      </div>
    </section>
  ) : null;
  usePageTitle(exhibit?.name ?? t('ui.exhibit.page-title', 'Chi tiết hiện vật'));
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
  const transcript = exhibit ? localizedTranscript(exhibit, locale) : null;

  let statusTitle: string | undefined;
  let statusMessage: string | undefined;
  let isLoading = false;
  let isError = false;
  if (!isValidId) {
    statusTitle = t('ui.exhibit.invalid-link', 'Đường dẫn hiện vật không hợp lệ');
    statusMessage = t('ui.exhibit.invalid-link-detail', 'Mã hiện vật trong đường dẫn không đúng định dạng.');
  } else if (rooms.isPending) {
    statusTitle = t('ui.exhibit.page-title', 'Chi tiết hiện vật');
    statusMessage = t('ui.rooms.loading', 'Đang tải danh sách phòng…');
    isLoading = true;
  } else if (rooms.isError) {
    statusTitle = t('ui.exhibit.load-error', 'Không tải được nội dung');
    statusMessage = errorText(rooms.error);
    isError = true;
  } else if (!selectedRoom) {
    statusTitle = t('ui.exhibit.room-not-found', 'Không tìm thấy phòng trưng bày');
    statusMessage = t('ui.exhibit.room-not-found-detail', 'Phòng trong đường dẫn không có trong danh sách công khai.');
  } else if (room.isPending) {
    statusTitle = t('ui.exhibit.page-title', 'Chi tiết hiện vật');
    statusMessage = t('ui.exhibit.loading', 'Đang tải hiện vật…');
    isLoading = true;
  } else if (room.isError) {
    statusTitle = t('ui.exhibit.load-error', 'Không tải được nội dung');
    statusMessage = errorText(room.error);
    isError = true;
  } else if (!exhibit) {
    statusTitle = t('ui.exhibit.not-found', 'Không tìm thấy hiện vật');
    statusMessage = t('ui.exhibit.not-found-detail', 'Hiện vật không có trong bộ sưu tập công khai của phòng này.');
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
        {isError && <Button mt="md" onClick={() => void (rooms.isError ? rooms.refetch() : room.refetch())}>{t('ui.common.retry', 'Thử lại')}</Button>}
        {recovery}
        {!isLoading && <p><Link to="/collection">{t('ui.exhibit.back-to-collection', 'Về bộ sưu tập')}</Link></p>}
      </> : detail && exhibit ? <article aria-labelledby="exhibit-title">
        <Link className={classes.backLink} to={`/collection?${new URLSearchParams({ room: detail.slug })}`}>{t('ui.exhibit.back-to-room', 'Quay lại bộ sưu tập của phòng này')}</Link>
        <header className={classes.header}>
          <p className={classes.roomName}>{detail.name}</p>
          <Title ref={titleRef} tabIndex={-1} order={1} id="exhibit-title" className={classes.title}>{exhibit.name}</Title>
          <div className={classes.headerActions}>
            <Link className={classes.jump3d}
              to={`/tour?${new URLSearchParams({ room: detail.slug, exhibit: exhibit.id })}`}>
              <IconCube size={18} aria-hidden="true" /> {t('ui.exhibit.view-3d', 'Xem trong không gian 3D')}
            </Link>
            <Button variant="default" onClick={() => setIsReportOpen(true)}>{t('ui.common.report-content', 'Báo nội dung')}</Button>
            <FavoriteButton target={{ roomId: detail.id, exhibitId: exhibit.id }} name={exhibit.name} />
          </div>
          <VisitorStorageStatus error={favorites.error} />
        </header>
        {tour2d.isCurrentRoute && tour2d.status !== 'idle' && <GuidedTour2DControls
          roomName={detail.name} exhibitName={exhibit.name} status={tour2d.status}
          currentIndex={tour2d.currentIndex} total={tour2d.total} canPrevious={tour2d.canPrevious}
          onPrevious={tour2d.previous} onPause={tour2d.pause} onResume={tour2d.resume}
          onNext={tour2d.next} onExit={tour2d.exit} onRestart={() => tour2d.restart(detail)} />}
        {!tour2d.isSameRoom && <Button color="teal.9" mt="md" onClick={() => tour2d.startFromExhibit(detail, exhibit.id)}>
          {t('ui.guided2d.start-from-exhibit', tourMessages.startFromExhibit)}
        </Button>}
        {recovery}
        <ReadingControls />
        {!hasTranslation(exhibit, locale) && (
          <p role="note" className={classes.body}>{t('ui.exhibit.translationMissing', 'Chưa có bản dịch, đang hiển thị tiếng Việt.')}</p>
        )}
        <div className={`${classes.content} ${reading.value.enabled ? classes.reading : ''}`}
          style={{ '--reading-scale': reading.value.fontScale } as CSSProperties}>
          <ExhibitImage image={exhibit.image ? { url: exhibit.image.url, alt: localizedAltText(exhibit.image.altText, locale, exhibit.name) } : null}
            shape={exhibit.placeholderShape} color={exhibit.placeholderColor} className={classes.preview} />
          <div className={classes.sections}>
            <div className={classes.audioDock}>
              <AudioPlayer key={`${detail.id}:${exhibit.id}:vi`} src={audio?.audio.url} subtitleUrl={audio?.subtitle?.url} locale="vi" />
            </div>
            <section aria-labelledby="exhibit-description-title">
              <Title order={2} id="exhibit-description-title" className={classes.sectionTitle}>{t('ui.exhibit.story', 'Câu chuyện hiện vật')}</Title>
              <p className={classes.body}>{exhibit.description || t('ui.common.no-description', 'Chưa có mô tả.')}</p>
            </section>
            {transcript && <section aria-labelledby="exhibit-transcript-title">
              <Title order={2} id="exhibit-transcript-title" className={classes.sectionTitle}>{t('ui.exhibit.transcript', 'Bản thuyết minh')}</Title>
              <p className={classes.body}>{transcript}</p>
            </section>}
            {exhibit.hotspots.length > 0 && <section aria-labelledby="exhibit-hotspots-title">
              <Title order={2} id="exhibit-hotspots-title" className={classes.sectionTitle}>{t('ui.exhibit.hotspots', 'Điểm chú ý')}</Title>
              <ul className={classes.hotspots} aria-label={t('ui.exhibit.hotspots-aria', 'Điểm chú ý của hiện vật')}>
                {[...exhibit.hotspots].sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id))
                  .map((hotspot) => <li key={hotspot.id}>
                    <p className={classes.hotspotLabel}>{hotspot.label}</p>
                    <p className={classes.body}>{hotspot.body}</p>
                  </li>)}
              </ul>
            </section>}
            {credits.length > 0 && <section aria-labelledby="exhibit-credits-title">
              <Title order={2} id="exhibit-credits-title" className={classes.sectionTitle}>{t('ui.exhibit.credits', 'Nguồn & bản quyền')}</Title>
              <MediaCreditList credits={credits} className={classes.body} />
            </section>}
          </div>
        </div>
        <VisitorNotes key={`${detail.id}:${exhibit.id}`} target={{ roomId: detail.id, exhibitId: exhibit.id }} />
      </article> : null}
      {exhibit && isReportOpen && <PublicReportModal key={`${exhibit.id}:${exhibit.revisionId}`} exhibitId={exhibit.id}
        reportedRevisionId={exhibit.revisionId} opened onClose={() => setIsReportOpen(false)} />}
    </Container>
  );
}
