import { Alert, Button, Text } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { useMuseumRooms } from '@/hooks/useMuseumRooms';
import { ExhibitGrid } from '@/shared/components/data/ExhibitGrid';
import classes from './HomePage.module.css';

export function HomeFeaturedExhibits() {
  const { rooms, room, selectedRoom } = useMuseumRooms(null);
  const detail = rooms.isSuccess && selectedRoom && room.isSuccess ? room.data : undefined;
  const featured = detail ? [...detail.exhibits]
    .sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id))
    .slice(0, 3) : [];

  if (rooms.isPending) return <p role="status">Đang tải danh sách phòng…</p>;
  if (rooms.isError) return (
    <Alert color="red" role="alert" title="Không tải được danh sách phòng">
      <Text>{rooms.error.message}</Text>
      <Button mt="sm" onClick={() => void rooms.refetch()}>Thử lại</Button>
    </Alert>
  );
  if (rooms.data.length === 0) return <p role="status">Chưa có phòng trưng bày công khai.</p>;
  if (room.isPending) return <p role="status">Đang tải hiện vật nổi bật…</p>;
  if (room.isError) return (
    <Alert color="red" role="alert" title="Không tải được hiện vật nổi bật">
      <Text>{room.error.message}</Text>
      <Button mt="sm" onClick={() => void room.refetch()}>Thử lại</Button>
    </Alert>
  );
  if (!detail) return null;

  return (
    <div className={classes.featuredContent}>
      <p className={classes.featuredRoom}>{detail.name}</p>
      {featured.length > 0 ? <>
        <p className={classes.featuredDescription}>Một số hiện vật theo thứ tự trưng bày</p>
        <ExhibitGrid exhibits={featured} />
      </> : <p role="status">Phòng này chưa có hiện vật được xuất bản.</p>}
      <Link to={`/collection?${new URLSearchParams({ room: detail.slug })}`} className={classes.textLink}>
        Xem bộ sưu tập của phòng này <IconArrowRight size={18} aria-hidden="true" />
      </Link>
    </div>
  );
}
