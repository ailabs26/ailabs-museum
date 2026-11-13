import { Button } from '@mantine/core';
import { IconPlayerPause, IconPlayerPlay, IconPlayerSkipBack, IconPlayerSkipForward, IconX } from '@tabler/icons-react';
import { usePublicLocale } from '@/core/i18n/public-locale';
import type { useGuidedCameraTour } from '@/hooks/useGuidedCameraTour';
import { GUIDED_TOUR_MESSAGES } from '@/helpers/guidedTourMessages';
import { GUIDED_TOUR_2D_MESSAGES } from '@/helpers/guidedTour2dMessages';
import classes from './GuidedTourBar.module.css';

export function GuidedTourBar({ controller, title, onContinue2D }: { controller: ReturnType<typeof useGuidedCameraTour>; title?: string; onContinue2D: () => void }) {
  const { locale, t } = usePublicLocale();
  const messages = GUIDED_TOUR_MESSAGES[locale] ?? GUIDED_TOUR_MESSAGES.vi;
  const modeMessages = GUIDED_TOUR_2D_MESSAGES[locale as keyof typeof GUIDED_TOUR_2D_MESSAGES] ?? GUIDED_TOUR_2D_MESSAGES.vi;
  const { tour, ready, start, phase } = controller;
  const labels = {
    idle: t('ui.guided.ready', messages.ready),
    moving: t('ui.guided.moving', messages.moving),
    viewing: t('ui.guided.viewing', messages.viewing),
    paused: t('ui.guided.paused', messages.paused),
    completed: t('ui.guided.completed', messages.completed),
    blocked: t('ui.guided.blocked', messages.blocked),
  };
  return <section className={classes.bar} aria-label={t('ui.guided.label', messages.label)}
    data-status={tour.status} data-phase={phase} data-exhibit={tour.currentStep?.exhibitId ?? ''}>
    {tour.status === 'idle' ? <><Button color="teal.9" onClick={start} disabled={!ready || !controller.canStart}
      aria-label={t('ui.guided.start', messages.start)}>{t('ui.guided.start', messages.start)}</Button>
      {!controller.canStart && <p>{t('ui.guided.empty', messages.empty)}</p>}</> : <>
      <div className={classes.status} role="status" aria-live="polite" aria-atomic="true">
        <span>{tour.currentIndex + 1}/{tour.total} {t('ui.guided.exhibits', messages.exhibits)} · {labels[phase]}</span>
        <strong title={title}>{title}</strong>
      </div>
      <div className={classes.actions}>
        <Button variant="default" aria-label={t('ui.guided.previous', messages.previous)} disabled={!tour.canPrevious} onClick={tour.previous}><IconPlayerSkipBack size={18} /></Button>
        {tour.status !== 'completed' && <Button color="teal.9" aria-label={tour.status === 'running' ? t('ui.guided.pause', messages.pause) : t('ui.guided.resume', messages.resume)}
          disabled={tour.status === 'paused' && !ready} onClick={tour.status === 'running' ? controller.pause : tour.resume}>
          {tour.status === 'running' ? <IconPlayerPause size={18} /> : <IconPlayerPlay size={18} />}
        </Button>}
        <Button variant="default" aria-label={t('ui.guided.next', messages.next)} disabled={!tour.canNext} onClick={tour.next}><IconPlayerSkipForward size={18} /></Button>
        <Button variant="default" aria-label={t('ui.guided.exit', messages.exit)} onClick={tour.exit}><IconX size={18} /></Button>
        <Button variant="default" onClick={onContinue2D}>{t('ui.guided2d.continue-2d', modeMessages.continue2d)}</Button>
      </div>
    </>}
  </section>;
}
