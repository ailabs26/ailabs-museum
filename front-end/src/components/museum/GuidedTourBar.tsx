import { Button } from '@mantine/core';
import { IconPlayerPause, IconPlayerPlay, IconPlayerSkipBack, IconPlayerSkipForward, IconX } from '@tabler/icons-react';
import { usePublicT } from '@/core/i18n/public-locale';
import type { useGuidedCameraTour } from '@/hooks/useGuidedCameraTour';
import classes from './GuidedTourBar.module.css';

export function GuidedTourBar({ controller, title }: { controller: ReturnType<typeof useGuidedCameraTour>; title?: string }) {
  const t = usePublicT();
  const { tour, ready, start, phase } = controller;
  const labels = {
    idle: t('ui.guided.ready', 'Sẵn sàng tham quan'),
    moving: t('ui.guided.moving', 'Đang di chuyển'),
    viewing: t('ui.guided.viewing', 'Đang xem'),
    paused: t('ui.guided.paused', 'Đã tạm dừng'),
    completed: t('ui.guided.completed', 'Hoàn thành'),
    blocked: t('ui.guided.blocked', 'Không tìm được góc nhìn an toàn. Đọc chi tiết hoặc chọn Tiếp theo.'),
  };
  return <section className={classes.bar} aria-label={t('ui.guided.label', 'Tham quan có hướng dẫn')}
    data-status={tour.status} data-phase={phase} data-exhibit={tour.currentStep?.exhibitId ?? ''}>
    {tour.status === 'idle' ? <><Button color="teal.9" onClick={start} disabled={!ready || !controller.canStart}
      aria-label={t('ui.guided.start', 'Bắt đầu tham quan có hướng dẫn')}>{t('ui.guided.start', 'Bắt đầu tham quan có hướng dẫn')}</Button>
      {!controller.canStart && <p>{t('ui.guided.empty', 'Phòng chưa có hiện vật để tham quan.')}</p>}</> : <>
      <div className={classes.status} role="status" aria-live="polite" aria-atomic="true">
        <span>{tour.currentIndex + 1}/{tour.total} {t('ui.guided.exhibits', 'hiện vật')} · {labels[phase]}</span>
        <strong title={title}>{title}</strong>
      </div>
      <div className={classes.actions}>
        <Button variant="default" aria-label={t('ui.guided.previous', 'Hiện vật trước')} disabled={!tour.canPrevious} onClick={tour.previous}><IconPlayerSkipBack size={18} /></Button>
        {tour.status !== 'completed' && <Button color="teal.9" aria-label={tour.status === 'running' ? t('ui.guided.pause', 'Tạm dừng') : t('ui.guided.resume', 'Tiếp tục')}
          disabled={tour.status === 'paused' && !ready} onClick={tour.status === 'running' ? tour.pause : tour.resume}>
          {tour.status === 'running' ? <IconPlayerPause size={18} /> : <IconPlayerPlay size={18} />}
        </Button>}
        <Button variant="default" aria-label={t('ui.guided.next', 'Hiện vật tiếp theo')} disabled={!tour.canNext} onClick={tour.next}><IconPlayerSkipForward size={18} /></Button>
        <Button variant="default" aria-label={t('ui.guided.exit', 'Thoát hướng dẫn')} onClick={tour.exit}><IconX size={18} /></Button>
      </div>
    </>}
  </section>;
}
