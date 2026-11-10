import { Button, Group, Progress, Text } from '@mantine/core';
import { usePublicLocale } from '@/core/i18n/public-locale';
import { GUIDED_TOUR_MESSAGES } from '@/helpers/guidedTourMessages';
import { GUIDED_TOUR_2D_MESSAGES } from '@/helpers/guidedTour2dMessages';
import type { GuidedTourStatus } from '@/interfaces/guidedTour';
import classes from './GuidedTour2DControls.module.css';

export function GuidedTour2DControls({
  roomName,
  exhibitName,
  status,
  currentIndex,
  total,
  canPrevious,
  onPrevious,
  onPause,
  onResume,
  onNext,
  onExit,
  onRestart,
}: {
  roomName: string;
  exhibitName: string;
  status: Exclude<GuidedTourStatus, 'idle'>;
  currentIndex: number;
  total: number;
  canPrevious: boolean;
  onPrevious: () => void;
  onPause: () => void;
  onResume: () => void;
  onNext: () => void;
  onExit: () => void;
  onRestart: () => void;
}) {
  const { locale, t } = usePublicLocale();
  const messages = GUIDED_TOUR_MESSAGES[locale] ?? GUIDED_TOUR_MESSAGES.vi;
  const tourMessages = GUIDED_TOUR_2D_MESSAGES[locale as keyof typeof GUIDED_TOUR_2D_MESSAGES] ?? GUIDED_TOUR_2D_MESSAGES.vi;
  const stateLabel = status === 'running' ? tourMessages.running
    : status === 'paused' ? tourMessages.paused : tourMessages.completed;
  const progressLabel = t('ui.guided2d.progress', `${tourMessages.step} {current}/{total}`, { current: currentIndex + 1, total });

  return (
    <section className={classes.controls} aria-label={t('ui.guided2d.label', tourMessages.label)}>
      <div className={classes.summary} role="status" aria-live="polite" aria-atomic="true">
        <Text size="sm" c="dimmed">{roomName}</Text>
        <Text fw={700}>{exhibitName}</Text>
        <Text size="sm">{progressLabel} · {t(`ui.guided2d.status.${status}`, stateLabel)}</Text>
        <Progress className={classes.progress} value={total ? ((currentIndex + 1) / total) * 100 : 0}
          aria-label={t('ui.guided2d.progress-label', tourMessages.progressLabel)} />
      </div>
      <Group className={classes.actions} gap="xs">
        <Button variant="default" disabled={!canPrevious} onClick={onPrevious}>
          {t('ui.guided.previous', messages.previous)}
        </Button>
        {status !== 'completed' && <Button color="teal.9" onClick={status === 'running' ? onPause : onResume}>
          {status === 'running' ? t('ui.guided.pause', messages.pause) : t('ui.guided.resume', messages.resume)}
        </Button>}
        {status !== 'completed' && <Button color="teal.9" onClick={onNext}>
          {t('ui.guided.next', messages.next)}
        </Button>}
        {status === 'completed' && <Button color="teal.9" onClick={onRestart}>
          {t('ui.guided2d.restart', tourMessages.restart)}
        </Button>}
        <Button variant="default" onClick={onExit}>{t('ui.guided.exit', messages.exit)}</Button>
      </Group>
    </section>
  );
}
