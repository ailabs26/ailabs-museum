import { Alert, Button, Text, Title } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { usePublicLocale } from '@/core/i18n/public-locale';
import { museumService } from '@/services/museum.service';
import type { RoomSummary } from '@/validations/roomSchema';
import classes from '../CollectionPage.module.css';

const MIN_QUERY_LENGTH = 2;

/**
 * Kết quả tìm kiếm ở các phòng KHÁC phòng đang xem. Ô tìm kiếm của trang lọc tại chỗ trong phòng hiện tại; khối này gọi
 * `/rooms/search` để khách không phải đoán hiện vật nằm ở phòng nào.
 */
export function GlobalExhibitSearch({ query, currentRoomId, rooms }: {
  query: string;
  currentRoomId: string | undefined;
  rooms: RoomSummary[];
}) {
  const { t } = usePublicLocale();
  const [debounced] = useDebouncedValue(query.trim(), 300);
  const enabled = debounced.length >= MIN_QUERY_LENGTH;
  const search = useInfiniteQuery({
    queryKey: ['public-exhibit-search', debounced],
    queryFn: ({ pageParam, signal }) => museumService.searchExhibits(debounced, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last, pages) =>
      pages.reduce((sum, page) => sum + page.items.length, 0) < last.total ? last.page + 1 : undefined,
    enabled,
  });

  if (!enabled) return null;
  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const results = (search.data?.pages.flatMap((page) => page.items) ?? [])
    .filter((item) => item.roomId !== currentRoomId && roomById.has(item.roomId));

  return (
    <section aria-labelledby="global-search-title" className={classes.globalSearch}>
      <Title order={2} id="global-search-title" className={classes.roomTitle}>{t('ui.collection.other-rooms', 'Ở các phòng khác')}</Title>
      {search.isPending ? <p role="status">Đang tìm trong toàn bảo tàng…</p>
        : search.isError ? (
          <Alert color="red" role="alert" title="Không tìm được ở các phòng khác">
            <Text>{search.error.message}</Text>
            <Button mt="sm" onClick={() => void search.refetch()}>Thử lại</Button>
          </Alert>
        ) : results.length === 0 && !search.hasNextPage ? (
          <p role="status" className={classes.count}>Không có hiện vật khớp “{debounced}” ở phòng khác.</p>
        ) : (
          <>
          <p role="status" className={classes.count}>Tìm thấy {results.length} hiện vật ở phòng khác</p>
          <ul className={classes.globalResults} aria-label="Kết quả ở các phòng khác">
            {results.map((item) => {
              const room = roomById.get(item.roomId)!;
              return (
                <li key={item.id}>
                  <Link className={classes.globalResult}
                    to={`/collection/${encodeURIComponent(room.slug)}/exhibits/${encodeURIComponent(item.id)}`}>
                    <strong>{item.name}</strong>
                    <span className={classes.count}>{room.name}</span>
                    <span className={classes.globalResultText}>{item.description}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          </>
        )}
      {search.hasNextPage && (
        <Button variant="default" mt="sm" loading={search.isFetchingNextPage} onClick={() => void search.fetchNextPage()}>
          Xem thêm kết quả
        </Button>
      )}
    </section>
  );
}
