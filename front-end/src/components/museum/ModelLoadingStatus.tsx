import { Button, Group, Progress, Stack, Text } from '@mantine/core';
import type { ModelSnapshot } from '@/helpers/roomModelAssets';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import { useEffect, useState } from 'react';
import type { ArtifactRenderState } from './ArtifactModelBoundary';

export function ModelLoadingStatus({ displays, models, onRetry, renderStates = {}, onRetryRender }: {
  displays: readonly MuseumDisplay[]; models: ModelSnapshot; onRetry: (checksum: string) => void;
  renderStates?: Readonly<Record<string, ArtifactRenderState>>; onRetryRender?: (id: string) => void;
}) {
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
  return <Stack gap="xs" py="sm" aria-label="Trạng thái mô hình 3D">
    <Text role="status" size="sm">Đã tải {ready}/{available.length} mô hình 3D</Text>
    {ready < available.length && <Progress value={progress} aria-label="Tiến độ tải mô hình" />}
    {available.map(display => {
      const state = models[display.model!.checksumSha256]; const renderState = renderStates[display.id];
      if (state?.status !== 'error' && !failedRender(display)) return null;
      const retriesRemaining = state?.status === 'error' ? state.retriesRemaining : 3 - renderState.attempts;
      const isCoolingDown = state?.status === 'error' && state.retryAt > Math.max(now, Date.now());
      return <Group key={display.id} gap="sm"><Text size="sm" c="red.8">Không tải được mô hình: {display.title}. {state?.status === 'error' ? state.message : 'Lỗi hiển thị mô hình.'}</Text>
        <Button size="xs" variant="light" disabled={retriesRemaining === 0 || isCoolingDown}
          onClick={() => state?.status === 'error' ? onRetry(display.model!.checksumSha256) : onRetryRender?.(display.id)}>Thử lại {display.title}</Button>
        <Text size="xs">{retriesRemaining === 0 ? 'Đã hết lượt thử. Vui lòng mở lại 3D hoặc liên hệ quản trị.' : isCoolingDown ? 'Vui lòng chờ trước khi thử lại.' : `Còn ${retriesRemaining} lượt thử.`}</Text>
      </Group>;
    })}
  </Stack>;
}
