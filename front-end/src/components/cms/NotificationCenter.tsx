import { ActionIcon, Anchor, Button, Indicator, Loader, Popover, ScrollArea, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconBell, IconCheck, IconChecklist, IconCircleCheck, IconCircleX, IconFlag, IconTrash } from '@tabler/icons-react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { isLongBody, relativeTime } from '@/helpers/notificationDisplay';
import { notificationsService, type NotificationItem, type NotificationType } from '@/services/notifications.service';
import { notify } from '@/shared/components/feedback/notify';
import classes from './NotificationCenter.module.css';

const PAGE_SIZE = 10;
const KEY = ['notifications'] as const;

const TYPE_ICON: Record<NotificationType, { icon: ReactNode; className: string }> = {
  'revision.submitted': { icon: <IconChecklist size={16} />, className: classes.iconReview },
  'revision.approved': { icon: <IconCircleCheck size={16} />, className: classes.iconApproved },
  'revision.rejected': { icon: <IconCircleX size={16} />, className: classes.iconReport },
  'report.created': { icon: <IconFlag size={16} />, className: classes.iconReport },
};

/** Chuông thông báo: số chưa đọc, danh sách (Xem thêm theo trang), đánh dấu đã đọc, xóa. */
export function NotificationCenter() {
  const [opened, setOpened] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const unread = useQuery({
    queryKey: [...KEY, 'unread'],
    queryFn: () => notificationsService.unreadCount(),
    refetchInterval: 60_000,
  });
  const list = useInfiniteQuery({
    queryKey: [...KEY, 'list'],
    queryFn: ({ pageParam }) => notificationsService.list(pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last, pages) =>
      pages.reduce((sum, page) => sum + page.items.length, 0) < last.total ? last.page + 1 : undefined,
    enabled: opened,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });
  const onError = (error: Error) => notify.error(error.message);
  const markRead = useMutation({ mutationFn: notificationsService.markRead, onSuccess: refresh, onError });
  const markAllRead = useMutation({ mutationFn: notificationsService.markAllRead, onSuccess: refresh, onError });
  const remove = useMutation({ mutationFn: notificationsService.remove, onSuccess: refresh, onError });

  const total = unread.data?.count ?? 0;
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];

  const open = (item: NotificationItem) => {
    if (!item.read) markRead.mutate(item.id);
    if (item.link) {
      setOpened(false);
      navigate(item.link);
    }
  };

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-end" withArrow shadow="md" width={360}>
      <Popover.Target>
        <Indicator color="red" size={16} label={total > 9 ? '9+' : total} disabled={total === 0} offset={4}>
          <ActionIcon variant="default" size="lg" radius="xl" aria-label={`Thông báo (${total} chưa đọc)`}
            onClick={() => setOpened((o) => !o)}>
            <IconBell size={18} stroke={1.6} />
          </ActionIcon>
        </Indicator>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <div className={classes.head}>
          <div>
            <Text fw={700} size="sm">Thông báo</Text>
            <Text size="xs" c="dimmed">{total > 0 ? `${total} chưa đọc` : 'Đã đọc hết'}</Text>
          </div>
          <Button variant="subtle" size="compact-xs" disabled={total === 0} loading={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}>
            Đánh dấu tất cả đã đọc
          </Button>
        </div>
        <ScrollArea.Autosize mah={420} type="auto">
          {list.isPending ? (
            <div className={classes.state}><Loader size="sm" /></div>
          ) : list.isError ? (
            <div className={classes.state}>
              <Text size="sm" c="red">Không tải được thông báo</Text>
              <Button variant="default" size="compact-xs" onClick={() => void list.refetch()}>Thử lại</Button>
            </div>
          ) : items.length === 0 ? (
            <div className={classes.state}><Text size="sm" c="dimmed">Chưa có thông báo nào</Text></div>
          ) : (
            <ul className={classes.list} aria-label="Danh sách thông báo">
              {items.map((item) => (
                <NotificationRow key={item.id} item={item} onOpen={() => open(item)}
                  onMarkRead={() => markRead.mutate(item.id)} onRemove={() => remove.mutate(item.id)} />
              ))}
            </ul>
          )}
          {list.hasNextPage && (
            <div className={classes.more}>
              <Button variant="subtle" size="compact-sm" fullWidth loading={list.isFetchingNextPage}
                onClick={() => void list.fetchNextPage()}>
                Xem thêm
              </Button>
            </div>
          )}
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}

function NotificationRow({ item, onOpen, onMarkRead, onRemove }: {
  item: NotificationItem; onOpen: () => void; onMarkRead: () => void; onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = isLongBody(item.body);
  const { icon, className } = TYPE_ICON[item.type] ?? TYPE_ICON['report.created'];

  return (
    <li className={classes.item} data-unread={!item.read || undefined}>
      <span className={className} aria-hidden>{icon}</span>
      <div className={classes.body}>
        <UnstyledButton className={classes.title} onClick={onOpen}>
          <Text size="sm" fw={item.read ? 500 : 700}>{item.title}</Text>
        </UnstyledButton>
        {item.body && (
          <>
            <Text size="xs" c="dimmed" lineClamp={long && !expanded ? 2 : undefined} className={classes.text}>
              {item.body}
            </Text>
            {long && (
              <Anchor component="button" type="button" size="xs" className={classes.toggle} onClick={() => setExpanded((e) => !e)}
                aria-expanded={expanded}>
                {expanded ? 'Thu gọn' : 'Xem thêm'}
              </Anchor>
            )}
          </>
        )}
        <Text size="xs" c="dimmed">
          {!item.read && <span className={classes.dot} aria-label="Chưa đọc" />}
          {relativeTime(item.createdAt)}
        </Text>
      </div>
      <div className={classes.actions}>
        {!item.read && (
          <Tooltip label="Đánh dấu đã đọc">
            <ActionIcon variant="subtle" size="sm" aria-label={`Đánh dấu đã đọc: ${item.title}`} onClick={onMarkRead}>
              <IconCheck size={14} />
            </ActionIcon>
          </Tooltip>
        )}
        <Tooltip label="Xóa">
          <ActionIcon variant="subtle" color="red" size="sm" aria-label={`Xóa thông báo: ${item.title}`} onClick={onRemove}>
            <IconTrash size={14} />
          </ActionIcon>
        </Tooltip>
      </div>
    </li>
  );
}
