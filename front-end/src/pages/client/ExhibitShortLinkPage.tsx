import { useEffect } from 'react';
import { Alert, Button, Container, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { ApiException } from '@/core/api/api-error';
import { usePublicLocale } from '@/core/i18n/public-locale';
import { detectPublicLocale, hasSavedPublicLocale } from '@/helpers/publicLocale';
import { usePageTitle } from '@/hooks/usePageTitle';
import { museumService } from '@/services/museum.service';

const exhibitIdSchema = z.string().uuid();

/** Đích của mã QR dán cạnh hiện vật: tìm phòng hiện tại rồi chuyển tới trang chi tiết. */
export function ExhibitShortLinkPage() {
  const { exhibitId = '' } = useParams<{ exhibitId: string }>();
  const navigate = useNavigate();
  const { t, setLocale } = usePublicLocale();
  const isValid = exhibitIdSchema.safeParse(exhibitId).success;
  usePageTitle(t('ui.short-link.loading', 'Đang mở hiện vật…'));

  // Khách quét mã lần đầu (chưa từng chọn ngôn ngữ): hiện theo ngôn ngữ của máy.
  useEffect(() => {
    if (!hasSavedPublicLocale()) setLocale(detectPublicLocale(navigator.languages?.length ? navigator.languages : [navigator.language]));
  }, [setLocale]);

  const location = useQuery({
    queryKey: ['exhibit-location', exhibitId],
    queryFn: ({ signal }) => museumService.exhibitLocation(exhibitId, signal),
    enabled: isValid,
    retry: false,
    meta: { public: true },
  });

  useEffect(() => {
    if (!location.data) return;
    const { roomSlug, exhibitId: id } = location.data;
    navigate(`/collection/${encodeURIComponent(roomSlug)}/exhibits/${encodeURIComponent(id)}`, { replace: true });
  }, [location.data, navigate]);

  if (isValid && (location.isPending || location.data)) {
    return <Container size="sm" py="xl"><p role="status">{t('ui.short-link.loading', 'Đang mở hiện vật…')}</p></Container>;
  }

  const isNotFound = !isValid || (location.error instanceof ApiException && location.error.status === 404);
  return (
    <Container size="sm" py="xl">
      <Alert color={isNotFound ? 'gray' : 'red'} role="alert"
        title={isNotFound ? t('ui.short-link.not-found', 'Không tìm thấy hiện vật') : t('ui.exhibit.load-error', 'Không tải được nội dung')}>
        <Text>{isNotFound
          ? t('ui.short-link.not-found-detail', 'Hiện vật này chưa được công khai hoặc đã được gỡ khỏi bộ sưu tập.')
          : t('ui.common.load-failed-detail', 'Vui lòng kiểm tra kết nối rồi thử lại.')}</Text>
        {!isNotFound && <Button mt="sm" onClick={() => void location.refetch()}>{t('ui.common.retry', 'Thử lại')}</Button>}
      </Alert>
      <p><Link to="/collection">{t('ui.exhibit.back-to-collection', 'Về bộ sưu tập')}</Link></p>
    </Container>
  );
}
