import { Button, Group, Progress, Stack, Text } from '@mantine/core';
import type { ModelSnapshot } from '@/helpers/roomModelAssets';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import { useEffect, useState } from 'react';
import type { ArtifactRenderState } from './ArtifactModelBoundary';
import { usePublicT, type Translator } from '@/core/i18n/public-locale';

/** Lỗi do `roomModelAssets` (không có React) đặt bằng tiếng Việt: dịch lúc hiển thị. */
const MODEL_MESSAGES = [
  { key: 'ui.models.error.format', label: 'Tệp mô hình bị hỏng hoặc có định dạng chưa hỗ trợ.' },
  { key: 'ui.models.error.load', label: 'Không tải được mô hình. Vui lòng thử lại.' },
] as const;

function modelMessage(message: string, t: Translator): string {
  const known = MODEL_MESSAGES.find((item) => item.label === message);
  return known ? t(known.key, known.label) : message;
}

export function ModelLoadingStatus({ displays, models, onRetry, renderStates = {}, onRetryRender }: {
  displays: readonly MuseumDisplay[]; models: ModelSnapshot; onRetry: (checksum: string) => void;
  renderStates?: Readonly<Record<string, ArtifactRenderState>>; onRetryRender?: (id: string) => void;
}) {
  const t = usePublicT();
  const [now, setNow] = useState(Date.now);
  const nextRetry = Math.min(...Object.values(models).flatMap(state => state.status === 'error' && state.retryAt > now ? [state.retryAt] : []));
  useEffect(() => {
    if (!Number.isFinite(nextRetry)) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, nextRetry - Date.now()) + 10);
    return () => window.clearTimeout(timer);
  }, [nextRetry]);
  const available = displays.filter(display => display.model && !display.isOutsideRoom);
  if (!available.length) return null;
  const failedRender = (display: MuseumDisplay) => renderStates[display.id]?.checksum === display.model?.checksumSha256 && renderStates[display.id]?.failed;
  const ready = available.filter(display => models[display.model!.checksumSha256]?.status === 'ready' && !failedRender(display)).length;
  const progress = available.reduce((sum, display) => {
    const state = models[display.model!.checksumSha256];
    return sum + (state?.status === 'ready' ? 1 : state?.status === 'loading' ? (state.progress ?? 0) * 0.9 : 0);
  }, 0) / available.length * 100;
  return <Stack gap="xs" py="sm" aria-label={t('ui.models.aria', 'Trạng thái mô hình 3D')}>
    <Text role="status" size="sm">{t('ui.models.loaded', 'Đã tải {ready}/{total} mô hình 3D', { ready, total: available.length })}</Text>
    {ready < available.length && <Progress value={progress} aria-label={t('ui.models.progress-aria', 'Tiến độ tải mô hình')} />}
    {available.map(display => {
      const state = models[display.model!.checksumSha256]; const renderState = renderStates[display.id];
      if (state?.status !== 'error' && !failedRender(display)) return null;
      const retriesRemaining = state?.status === 'error' ? state.retriesRemaining : 3 - renderState.attempts;
      const isCoolingDown = state?.status === 'error' && state.retryAt > Math.max(now, Date.now());
      return <Group key={display.id} gap="sm"><Text size="sm" c="red.8">{t('ui.models.failed', 'Không tải được mô hình: {name}.', { name: display.title })} {state?.status === 'error' ? modelMessage(state.message, t) : t('ui.models.render-error', 'Lỗi hiển thị mô hình.')}</Text>
        <Button size="xs" variant="light" disabled={retriesRemaining === 0 || isCoolingDown}
          onClick={() => state?.status === 'error' ? onRetry(display.model!.checksumSha256) : onRetryRender?.(display.id)}>{t('ui.models.retry', 'Thử lại {name}', { name: display.title })}</Button>
        <Text size="xs">{retriesRemaining === 0 ? t('ui.models.no-retries', 'Đã hết lượt thử. Vui lòng mở lại 3D hoặc liên hệ quản trị.')
          : isCoolingDown ? t('ui.models.wait', 'Vui lòng chờ trước khi thử lại.') : t('ui.models.retries-left', 'Còn {count} lượt thử.', { count: retriesRemaining })}</Text>
      </Group>;
    })}
  </Stack>;
}
