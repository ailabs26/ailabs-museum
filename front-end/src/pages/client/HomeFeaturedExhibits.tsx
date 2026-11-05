import { Alert, Button, Text } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { usePublicLocale } from '@/core/i18n/public-locale';
import { useMuseumRooms } from '@/hooks/useMuseumRooms';
import { ExhibitGrid } from '@/shared/components/data/ExhibitGrid';
import classes from './HomePage.module.css';

export function HomeFeaturedExhibits() {
  const { t } = usePublicLocale();
  const { rooms, room, selectedRoom } = useMuseumRooms(null);
  const detail = rooms.isSuccess && selectedRoom && room.isSuccess ? room.data : undefined;
  const featured = detail ? [...detail.exhibits]
    .sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id))
    .slice(0, 3) : [];

  if (rooms.isPending) return <p role="status">{t('ui.home.featured.loading-rooms', 'Đang tải danh sách phòng…')}</p>;
  if (rooms.isError) return (
    <Alert color="red" role="alert" title={t('ui.home.featured.rooms-error', 'Không tải được danh sách phòng')}>
      <Text>{rooms.error.message}</Text>
      <Button mt="sm" onClick={() => void rooms.refetch()}>{t('ui.home.featured.retry', 'Thử lại')}</Button>
    </Alert>
  );
  if (rooms.data.length === 0) return <p role="status">{t('ui.home.featured.empty-rooms', 'Chưa có phòng trưng bày công khai.')}</p>;
  if (room.isPending) return <p role="status">{t('ui.home.featured.loading-exhibits', 'Đang tải hiện vật nổi bật…')}</p>;
  if (room.isError) return (
    <Alert color="red" role="alert" title={t('ui.home.featured.exhibits-error', 'Không tải được hiện vật nổi bật')}>
      <Text>{room.error.message}</Text>
      <Button mt="sm" onClick={() => void room.refetch()}>{t('ui.home.featured.retry', 'Thử lại')}</Button>
    </Alert>
  );
  if (!detail) return null;

  return (
    <div className={classes.featuredContent}>
      <p className={classes.featuredRoom}>{detail.name}</p>
      {featured.length > 0 ? <>
        <p className={classes.featuredDescription}>{t('ui.home.featured.description', 'Một số hiện vật theo thứ tự trưng bày')}</p>
        <ExhibitGrid exhibits={featured} roomSlug={detail.slug} />
      </> : <p role="status">{t('ui.home.featured.empty-exhibits', 'Phòng này chưa có hiện vật được xuất bản.')}</p>}
      <Link to={`/collection?${new URLSearchParams({ room: detail.slug })}`} className={classes.textLink}>
        {t('ui.home.featured.room-collection', 'Xem bộ sưu tập của phòng này')} <IconArrowRight size={18} aria-hidden="true" />
      </Link>
    </div>
  );
}
