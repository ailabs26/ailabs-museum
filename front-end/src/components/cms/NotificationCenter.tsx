import { ActionIcon, Indicator, Popover, Text, UnstyledButton } from '@mantine/core';
import { IconBell, IconChecklist, IconFlag } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { statsService } from '@/services/stats.service';
import classes from './NotificationCenter.module.css';

/** Chuông thông báo: liệt kê sự kiện nóng (chờ duyệt, báo cáo mở) kèm badge số lượng động. */
export function NotificationCenter() {
  const [opened, setOpened] = useState(false);
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ['stats', 'overview'], queryFn: () => statsService.overview() });

  const inReview = data?.revisions.inReview ?? 0;
  const reportsOpen = data?.reports.open ?? 0;
  const total = inReview + reportsOpen;

  const open = (to: string) => { setOpened(false); navigate(to); };

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-end" withArrow shadow="md" width={300}>
      <Popover.Target>
        <Indicator color="red" size={16} label={total > 9 ? '9+' : total} disabled={total === 0} offset={4}>
          <ActionIcon variant="default" size="lg" radius="xl" aria-label={`Thông báo (${total} mục cần xử lý)`}
            onClick={() => setOpened((o) => !o)}>
            <IconBell size={18} stroke={1.6} />
          </ActionIcon>
        </Indicator>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <div className={classes.head}>
          <Text fw={700} size="sm">Thông báo</Text>
          <Text size="xs" c="dimmed">{total > 0 ? `${total} mục cần chú ý` : 'Không có mục nào chờ xử lý'}</Text>
        </div>
        <div className={classes.list}>
          <UnstyledButton className={classes.item} onClick={() => open('/admin/moderation')}>
            <span className={classes.iconReview}><IconChecklist size={16} /></span>
            <span className={classes.body}>
              <Text size="sm" fw={600}>{inReview} phiên bản chờ duyệt</Text>
              <Text size="xs" c="dimmed">Mở trang Kiểm duyệt</Text>
            </span>
          </UnstyledButton>
          <UnstyledButton className={classes.item} onClick={() => open('/admin/reports')}>
            <span className={classes.iconReport}><IconFlag size={16} /></span>
            <span className={classes.body}>
              <Text size="sm" fw={600}>{reportsOpen} báo cáo vi phạm mở</Text>
              <Text size="xs" c="dimmed">Mở trang Báo cáo</Text>
            </span>
          </UnstyledButton>
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
