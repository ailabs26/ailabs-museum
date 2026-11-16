import { Alert, Button, Text } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { usePublicLocale } from '@/core/i18n/public-locale';
import { localizeExhibit } from '@/helpers/localizeExhibit';
import type { useMuseumRooms } from '@/hooks/useMuseumRooms';
import type { RoomDetail } from '@/validations/roomSchema';
import { ExhibitGrid } from '@/shared/components/data/ExhibitGrid';
import classes from './HomePage.module.css';

type HomeFeaturedExhibitsProps = {
  rooms: ReturnType<typeof useMuseumRooms>['rooms'];
  room: ReturnType<typeof useMuseumRooms>['room'];
  detail?: RoomDetail;
  exhibits: readonly RoomDetail['exhibits'][number][];
};

export function HomeFeaturedExhibits({ rooms, room, detail, exhibits }: HomeFeaturedExhibitsProps) {
  const { locale, t } = usePublicLocale();
  const featured = detail ? exhibits.map((exhibit) => localizeExhibit(exhibit, locale)) : [];

  if (rooms.isPending) return <p role="status">{t('ui.rooms.loading', 'Đang tải danh sách phòng…')}</p>;
  if (rooms.isError) return (
    <Alert color="red" role="alert" title={t('ui.rooms.load-error', 'Không tải được danh sách phòng')}>
      <Text>{rooms.error.message}</Text>
      <Button mt="sm" onClick={() => void rooms.refetch()}>{t('ui.common.retry', 'Thử lại')}</Button>
    </Alert>
  );
  if (rooms.data.length === 0) return <p role="status">{t('ui.rooms.empty', 'Chưa có phòng trưng bày công khai.')}</p>;
  if (room.isPending) return <p role="status">{t('ui.home.featured.loading', 'Đang tải hiện vật nổi bật…')}</p>;
  if (room.isError) return (
    <Alert color="red" role="alert" title={t('ui.home.featured.load-error', 'Không tải được hiện vật nổi bật')}>
      <Text>{room.error.message}</Text>
      <Button mt="sm" onClick={() => void room.refetch()}>{t('ui.common.retry', 'Thử lại')}</Button>
    </Alert>
  );
  if (!detail) return null;

  return (
    <div className={classes.featuredContent}>
      <p className={classes.featuredRoom}>{detail.name}</p>
      {featured.length > 0 ? <>
        <ExhibitGrid exhibits={featured} roomSlug={detail.slug} />
      </> : <p role="status">{t('ui.rooms.no-exhibits', 'Phòng này chưa có hiện vật được xuất bản.')}</p>}
      <Link to={`/collection?${new URLSearchParams({ room: detail.slug })}`} className={classes.textLink}>
        {t('ui.home.featured.view-room', 'Xem bộ sưu tập của phòng này')} <IconArrowRight size={18} aria-hidden="true" />
      </Link>
    </div>
  );
}
