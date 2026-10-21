import { useEffect, useRef } from 'react';
import { Badge, Button, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import { ExhibitImage } from './ExhibitImage';
import classes from './ExhibitDetailPanel.module.css';

/** Published text only; nonmodal so the scene and room selector stay usable. */
export function ExhibitDetailPanel({ display, onClose, detail2dHref }: { display: MuseumDisplay; onClose: () => void; detail2dHref: string }) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => titleRef.current?.focus(), [display.id]);
  return (
    <aside aria-label="Chi tiết hiện vật" className={classes.panel}>
      <Stack gap="lg">
        <div className={classes.header}>
          <Badge color="teal.9" variant="light">Đang xem</Badge>
          <Button variant="subtle" color="dark" onClick={onClose} aria-label="Đóng chi tiết hiện vật">Đóng ×</Button>
        </div>
        <Title ref={titleRef} tabIndex={-1} order={2} size="h3" className={classes.title}>{display.title}</Title>
        <Link to={detail2dHref}>Đọc chi tiết 2D</Link>
        <ExhibitImage display={display} className={classes.preview} />
        {display.model && <Text size="sm" c="teal.9">Khám phá mô hình hiện vật trong phòng 3D.</Text>}
        <section aria-label="Mô tả hiện vật">
          <Title order={3} size="h5" mb="xs">Câu chuyện hiện vật</Title>
          <Text size="sm" className={classes.body}>{display.description || 'Chưa có mô tả.'}</Text>
        </section>
        {display.transcript && <section aria-label="Bản thuyết minh">
          <Title order={3} size="h5" mb="xs">Bản thuyết minh</Title>
          <Text size="sm" className={classes.body}>{display.transcript}</Text>
        </section>}
        {!!display.hotspots?.length && <section aria-label="Điểm chú ý">
          <Title order={3} size="h5" mb="sm">Điểm chú ý</Title>
          <Stack gap="md">{display.hotspots.map((hotspot, index) => <div key={`${hotspot.id}-${index}`}>
            <Text fw={600} size="sm" className={classes.body}>{hotspot.label}</Text>
            <Text size="sm" className={classes.body}>{hotspot.body}</Text>
          </div>)}</Stack>
        </section>}
        {display.isOutsideRoom && <Text size="sm">Hiện vật nằm ngoài phạm vi phòng 3D. Thông tin vẫn có thể đọc tại đây.</Text>}
        <Text size="xs" c="dimmed">Escape để đóng · Chọn hiện vật khác để tiếp tục khám phá</Text>
      </Stack>
    </aside>
  );
}
