import { useEffect, useMemo, useState } from 'react';
import { Alert, Anchor, Button, Group, Loader, Stack, Switch, Text } from '@mantine/core';
import { IconArrowLeft, IconPrinter } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { exhibitQrSvg, exhibitShortUrl, svgDataUrl } from '@/helpers/exhibitQr';
import { resolveBilingualText } from '@/helpers/exhibitHotspots';
import { exhibitsService, type ExhibitRow } from '@/services/exhibits.service';
import { roomsService } from '@/services/rooms.service';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import classes from './RoomQrPrintPage.module.css';

const PAGE_SIZE = 100;

/** Mọi hiện vật (chưa xóa) của phòng, tải đủ các trang. */
async function listRoomExhibits(roomId: string): Promise<ExhibitRow[]> {
  const items: ExhibitRow[] = [];
  for (let page = 1; ; page++) {
    const result = await exhibitsService.list({ roomId, page, pageSize: PAGE_SIZE });
    items.push(...result.items);
    if (items.length >= result.total || result.items.length === 0) return items;
  }
}

const isPublic = (exhibit: ExhibitRow) => exhibit.status === 'published' && exhibit.visibility === 'visible';

/** Trang in mã QR của cả một phòng (khổ A4) để dán cạnh hiện vật thật. */
export function RoomQrPrintPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [onlyPublic, setOnlyPublic] = useState(true);
  const [codes, setCodes] = useState<Record<string, string>>({});

  const room = useQuery({ queryKey: ['rooms', 'qr', id], queryFn: () => roomsService.get(id) });
  const exhibits = useQuery({ queryKey: ['admin-exhibits', 'qr', id], queryFn: () => listRoomExhibits(id) });

  const shown = useMemo(() => [...(exhibits.data ?? [])]
    .filter((exhibit) => !onlyPublic || isPublic(exhibit))
    .sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id)), [exhibits.data, onlyPublic]);

  useEffect(() => {
    let cancelled = false;
    const missing = (exhibits.data ?? []).filter((exhibit) => !codes[exhibit.id]);
    if (missing.length === 0) return;
    Promise.all(missing.map(async (exhibit) => [exhibit.id, await exhibitQrSvg(exhibitShortUrl(exhibit.id))] as const))
      .then((entries) => { if (!cancelled) setCodes((current) => ({ ...current, ...Object.fromEntries(entries) })); });
    return () => { cancelled = true; };
  }, [exhibits.data, codes]);

  const hiddenCount = (exhibits.data?.length ?? 0) - (exhibits.data ?? []).filter(isPublic).length;

  return (
    <Stack>
      <PageHeader title={`In mã QR — ${room.data?.name ?? 'Phòng trưng bày'}`}
        description="Mỗi ô một hiện vật. Khách quét mã để mở trang chi tiết bằng ngôn ngữ của máy." />
      <Group justify="space-between">
        <Anchor component={Link} to="/admin/rooms"><Group gap={4}><IconArrowLeft size={16} /> Về danh sách phòng</Group></Anchor>
        <Group>
          <Switch label="Chỉ hiện vật đã xuất bản" checked={onlyPublic} onChange={(event) => setOnlyPublic(event.currentTarget.checked)} />
          <Button leftSection={<IconPrinter size={16} />} disabled={shown.length === 0} onClick={() => window.print()}>In</Button>
        </Group>
      </Group>

      {room.isError || exhibits.isError ? <Alert color="red" role="alert">Không tải được phòng hoặc danh sách hiện vật.</Alert>
        : exhibits.isPending ? <Loader />
        : shown.length === 0 ? <Text c="dimmed" role="status">{onlyPublic && hiddenCount > 0
          ? `Phòng chưa có hiện vật đã xuất bản (${hiddenCount} hiện vật chưa công khai).`
          : 'Phòng này chưa có hiện vật.'}</Text>
        : (
          <div className={classes.printArea}>
            {!onlyPublic && hiddenCount > 0 && (
              <Text size="sm" c="orange.8" mb="sm">{hiddenCount} hiện vật chưa công khai: khách quét mã sẽ chưa mở được.</Text>
            )}
            <ul className={classes.grid} aria-label="Mã QR các hiện vật" style={{ listStyle: 'none', padding: 0 }}>
              {shown.map((exhibit) => {
                const name = resolveBilingualText(exhibit.content.name).vi || 'Chưa đặt tên';
                return (
                  <li key={exhibit.id} className={classes.cell}>
                    {codes[exhibit.id] ? <img src={svgDataUrl(codes[exhibit.id])} alt={`Mã QR ${name}`} /> : <Loader size="sm" />}
                    <p className={classes.name}>{name}</p>
                    <p className={classes.code}>{exhibit.id.slice(0, 8)}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
    </Stack>
  );
}
