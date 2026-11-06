import { Anchor, Button, Stack, Text, Title } from '@mantine/core';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Translator } from '@/core/i18n/public-locale';

export function SceneFallback({ read2dHref, onUnavailable, onRetry, retriesRemaining = 0, translate }: {
  read2dHref: string; onUnavailable: () => void; onRetry?: () => void; retriesRemaining?: number;
  translate: Translator;
}) {
  const messageRef = useRef<HTMLDivElement>(null);
  useEffect(() => { onUnavailable(); }, [onUnavailable]);
  useEffect(() => messageRef.current?.focus({ preventScroll: true }), []);
  return (
    <Stack ref={messageRef} tabIndex={-1} align="center" justify="center" h="100%" p="xl" ta="center" role="status">
      <Title order={2} size="h3">{translate('ui.tour.fallback.title', 'Không thể mở không gian 3D')}</Title>
      <Text>{translate('ui.tour.fallback.description', 'Thiết bị có thể không hỗ trợ WebGL hoặc phần hiển thị chưa tải được.')}</Text>
      <Link to={read2dHref} state={{ fromTourFallback: true }}>{translate('ui.tour.fallback.read2d', 'Tiếp tục đọc trong giao diện 2D')}</Link>
      <Anchor href="#museum-catalogue">{translate('ui.tour.fallback.catalogue', 'Đọc nội dung phòng trưng bày')}</Anchor>
      {onRetry && retriesRemaining > 0 && <Button variant="default" onClick={onRetry}>{translate('ui.tour.fallback.retry', 'Thử lại 3D')}</Button>}
      {onRetry && <Text size="sm">{retriesRemaining > 0
        ? translate('ui.tour.fallback.retries', 'Còn {count} lượt thử 3D trong lần tham quan này.').replace('{count}', String(retriesRemaining))
        : translate('ui.tour.fallback.exhausted', 'Đã hết lượt thử 3D. Bạn vẫn có thể đọc toàn bộ nội dung 2D.')}</Text>}
    </Stack>
  );
}
