import { Container, Title } from '@mantine/core';
import { useParams } from 'react-router-dom';
import { z } from 'zod';
import { useMuseumRooms } from '@/hooks/useMuseumRooms';
import { ExhibitPreview } from '@/shared/components/data/ExhibitPreview';
import classes from './ExhibitDetailPage.module.css';

export function ExhibitDetailPage() {
  const { roomSlug, exhibitId } = useParams<{ roomSlug: string; exhibitId: string }>();
  const { rooms, room, selectedRoom } = useMuseumRooms(roomSlug ?? '');
  const isValidId = z.string().uuid().safeParse(exhibitId).success;
  const detail = rooms.isSuccess && selectedRoom && room.isSuccess ? room.data : undefined;
  const exhibit = detail && isValidId ? detail.exhibits.find((item) => item.id === exhibitId) : undefined;

  let statusTitle: string | undefined;
  let statusMessage: string | undefined;
  let isLoading = false;
  let isError = false;
  if (!isValidId) {
    statusTitle = 'Đường dẫn hiện vật không hợp lệ';
    statusMessage = 'Mã hiện vật trong đường dẫn không đúng định dạng.';
  } else if (rooms.isPending) {
    statusTitle = 'Chi tiết hiện vật';
    statusMessage = 'Đang tải danh sách phòng…';
    isLoading = true;
  } else if (rooms.isError) {
    statusTitle = 'Không tải được nội dung';
    statusMessage = rooms.error.message;
    isError = true;
  } else if (!selectedRoom) {
    statusTitle = 'Không tìm thấy phòng trưng bày';
    statusMessage = 'Phòng trong đường dẫn không có trong danh sách công khai.';
  } else if (room.isPending) {
    statusTitle = 'Chi tiết hiện vật';
    statusMessage = 'Đang tải hiện vật…';
    isLoading = true;
  } else if (room.isError) {
    statusTitle = 'Không tải được nội dung';
    statusMessage = room.error.message;
    isError = true;
  } else if (!exhibit) {
    statusTitle = 'Không tìm thấy hiện vật';
    statusMessage = 'Hiện vật không có trong bộ sưu tập công khai của phòng này.';
  }

  return (
    <Container size="lg" className={classes.page}>
      {statusTitle ? <>
        <Title order={1} className={classes.title}>{statusTitle}</Title>
        <p role={isError ? 'alert' : isLoading ? 'status' : undefined} className={classes.body}>{statusMessage}</p>
      </> : detail && exhibit ? <article aria-labelledby="exhibit-title">
        <header className={classes.header}>
          <p className={classes.roomName}>{detail.name}</p>
          <Title order={1} id="exhibit-title" className={classes.title}>{exhibit.name}</Title>
        </header>
        <div className={classes.content}>
          <ExhibitPreview shape={exhibit.placeholderShape} color={exhibit.placeholderColor} className={classes.preview} />
          <section aria-labelledby="exhibit-description-title">
            <Title order={2} id="exhibit-description-title" className={classes.sectionTitle}>Câu chuyện hiện vật</Title>
            <p className={classes.body}>{exhibit.description || 'Chưa có mô tả.'}</p>
          </section>
        </div>
      </article> : null}
    </Container>
  );
}
