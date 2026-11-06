import { useEffect, useRef } from 'react';
import { Badge, Button, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import { ExhibitImage } from '@/shared/components/media/ExhibitImage';
import { AudioPlayer } from '@/shared/components/media/AudioPlayer';
import { MediaCreditList } from './MediaCreditList';
import classes from './ExhibitDetailPanel.module.css';
import type { Translator } from '@/core/i18n/public-locale';

/** Nonmodal so the scene and room selector stay usable. CMS preview omits the 2D link (drafts have no public page). */
export function ExhibitDetailPanel({ display, onClose, detail2dHref, onReport, translate }: {
  display: MuseumDisplay;
  onClose: () => void;
  detail2dHref?: string;
  onReport?: () => void;
  translate?: Translator;
}) {
  const t = translate ?? ((_key: string, fallback: string) => fallback);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => titleRef.current?.focus(), [display.id]);
  return (
    <aside aria-label={t('ui.tour.panel.label', 'Chi tiết hiện vật')} className={classes.panel}>
      <Stack gap="lg">
        <div className={classes.header}>
          <Badge color="teal.9" variant="light">{t('ui.tour.panel.viewing', 'Đang xem')}</Badge>
          <Button variant="subtle" color="dark" onClick={onClose} aria-label={t('ui.tour.panel.close', 'Đóng chi tiết hiện vật')}>{t('ui.tour.panel.close.action', 'Đóng')} ×</Button>
        </div>
        <Title ref={titleRef} tabIndex={-1} order={2} size="h3" className={classes.title}>{display.title}</Title>
        {detail2dHref && <Link to={detail2dHref}>{t('ui.tour.panel.read2d', 'Đọc chi tiết 2D')}</Link>}
        {onReport && <Button variant="default" onClick={onReport}>{t('ui.tour.panel.report', 'Báo nội dung')}</Button>}
        <ExhibitImage image={display.image} shape={display.shape} color={display.color} className={classes.preview} />
        {display.model && <Text size="sm" c="teal.9">{t('ui.tour.panel.model', 'Khám phá mô hình hiện vật trong phòng 3D.')}</Text>}
        <AudioPlayer key={`${display.roomId}:${display.id}:${display.audioLocale ?? 'vi'}`} src={display.audio?.audio.url}
          subtitleUrl={display.audio?.subtitle?.url} locale={display.audioLocale} translate={translate} />
        <section aria-label={t('ui.tour.panel.description', 'Mô tả hiện vật')}>
          <Title order={3} size="h5" mb="xs">{t('ui.tour.panel.story', 'Câu chuyện hiện vật')}</Title>
          <Text size="sm" className={classes.body}>{display.description || t('ui.tour.panel.empty', 'Chưa có mô tả.')}</Text>
        </section>
        {display.transcript && <section aria-label={t('ui.tour.panel.transcript', 'Bản thuyết minh')}>
          <Title order={3} size="h5" mb="xs">{t('ui.tour.panel.transcript', 'Bản thuyết minh')}</Title>
          <Text size="sm" className={classes.body}>{display.transcript}</Text>
        </section>}
        {!!display.hotspots?.length && <section aria-label={t('ui.tour.panel.hotspots', 'Điểm chú ý')}>
          <Title order={3} size="h5" mb="sm">{t('ui.tour.panel.hotspots', 'Điểm chú ý')}</Title>
          <Stack gap="md">{display.hotspots.map((hotspot, index) => <div key={`${hotspot.id}-${index}`}>
            <Text fw={600} size="sm" className={classes.body}>{hotspot.label}</Text>
            <Text size="sm" className={classes.body}>{hotspot.body}</Text>
          </div>)}</Stack>
        </section>}
        {!!display.credits?.length && <section aria-label={t('ui.tour.panel.credits.aria', 'Nguồn và bản quyền')}>
          <Title order={3} size="h5" mb="xs">{t('ui.tour.panel.credits', 'Nguồn & bản quyền')}</Title>
          <Text size="sm" component="div" className={classes.body}><MediaCreditList credits={display.credits} /></Text>
        </section>}
        {display.isOutsideRoom && <Text size="sm">{t('ui.tour.panel.outside-room', 'Hiện vật nằm ngoài phạm vi phòng 3D. Thông tin vẫn có thể đọc tại đây.')}</Text>}
        <Text size="xs" c="dimmed">{t('ui.tour.panel.help', 'Escape để đóng · Chọn hiện vật khác để tiếp tục khám phá')}</Text>
      </Stack>
    </aside>
  );
}
