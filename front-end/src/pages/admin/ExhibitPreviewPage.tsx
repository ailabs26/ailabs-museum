import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { Alert, Anchor, Badge, Center, Code, Group, Loader, SegmentedControl, Stack, Text } from '@mantine/core';
import { IconAlertCircle, IconArrowLeft, IconInfoCircle } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ExhibitDetailPanel } from '@/components/museum/ExhibitDetailPanel';
import { mergeDraftIntoRoom, toDraftDisplay } from '@/helpers/draftPreviewDisplay';
import type { PreviewLocale } from '@/helpers/draftPreviewDisplay';
import { resolveBilingualText } from '@/helpers/exhibitHotspots';
import { mapRoomDisplays } from '@/helpers/mapRoomDisplays';
import type { RevisionState, Vector3 } from '@/services/exhibits.service';
import { exhibitsService } from '@/services/exhibits.service';
import { mediaService } from '@/services/media.service';
import { museumService } from '@/services/museum.service';
import { ErrorBoundary } from '@/shared/components/feedback/ErrorBoundary';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import classes from './ExhibitPreviewPage.module.css';

const LazyMuseumScene = lazy(() => import('@/components/MuseumScene').then((module) => ({ default: module.MuseumScene })));

const STATE_LABEL: Record<RevisionState, { label: string; color: string }> = {
  draft: { label: 'Bản nháp', color: 'gray' },
  in_review: { label: 'Chờ duyệt', color: 'yellow' },
  approved: { label: 'Đã duyệt', color: 'teal' },
  rejected: { label: 'Bị từ chối', color: 'red' },
};

const formatVector = (value: Vector3 | undefined, fallback: number) => {
  const { x, y, z } = value ?? { x: fallback, y: fallback, z: fallback };
  return `${x}, ${y}, ${z}`;
};

const sceneUnavailable = (
  <Center h="100%" p="xl">
    <Text ta="center">Trình duyệt không mở được không gian 3D. Nội dung bản nháp vẫn xem được ở khung chi tiết.</Text>
  </Center>
);

/**
 * Preview 3D bản nháp (FR-69–71): đặt revision mới nhất vào phòng trưng bày giữa các hiện vật đã
 * xuất bản, dùng chính scene của tour — vị trí, model, nhãn, hotspot, nội dung theo từng ngôn ngữ.
 */
export function ExhibitPreviewPage() {
  const { id = '' } = useParams();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [locale, setLocale] = useState<PreviewLocale>('vi');
  const [selectedId, setSelectedId] = useState<string | null>(id);

  const detailQuery = useQuery({
    queryKey: ['admin-exhibit-detail', id],
    queryFn: () => exhibitsService.get(id),
    enabled: !!id,
  });
  const detail = detailQuery.data;
  const modelId = detail?.content.modelId ?? null;

  const modelQuery = useQuery({
    queryKey: ['admin-media', modelId],
    queryFn: () => mediaService.get(modelId as string),
    enabled: !!modelId,
  });

  // Hiện vật khác trong phòng: đúng dữ liệu công khai khách đang thấy (phòng lưu trữ → chỉ có bản nháp).
  const room = detail?.room ?? null;
  const roomQuery = useQuery({
    queryKey: ['public-room', room?.slug],
    queryFn: ({ signal }) =>
      museumService.getRoom({ id: room!.id, slug: room!.slug, name: room!.name, description: null }, signal),
    enabled: !!room,
    retry: false,
  });

  const modelReady = !modelId || modelQuery.isSuccess || modelQuery.isError;
  const roomSettled = !room || roomQuery.isSuccess || roomQuery.isError;
  const draftModel = modelQuery.data?.processingState === 'ready' ? modelQuery.data : null;

  const displays = useMemo(() => {
    if (!detail || !modelReady || !roomSettled) return [];
    const neighbours = roomQuery.data ? mapRoomDisplays(roomQuery.data) : [];
    return mergeDraftIntoRoom(neighbours, toDraftDisplay(detail, draftModel, locale));
  }, [detail, draftModel, locale, modelReady, roomQuery.data, roomSettled]);
  const selected = displays.find((display) => display.id === selectedId);

  if (detailQuery.isLoading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }
  if (!detail) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={18} />} title="Không mở được bản xem trước">
        {detailQuery.error instanceof Error ? detailQuery.error.message : 'Không tìm thấy hiện vật.'}
      </Alert>
    );
  }

  const name = resolveBilingualText(detail.content.name);
  const state = STATE_LABEL[detail.revisionState];
  return (
    <Stack gap="md">
      <Anchor component={Link} to="/admin/exhibits" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} /> Quay lại danh sách hiện vật
        </Group>
      </Anchor>
      <PageHeader
        titleRef={titleRef}
        title={`Xem trước 3D: ${name.vi || name.en || detail.id.slice(0, 8)}`}
        description="Bản xem trước của phiên bản mới nhất — chỉ người quản trị thấy, khách tham quan vẫn xem bản đã xuất bản."
      />

      <Group justify="space-between" align="flex-end">
        <Group gap="xs">
          <Badge color={state.color}>{state.label}</Badge>
          <Badge variant="light">Bản #{detail.currentRevisionNo}</Badge>
          {detail.status === 'published' && <Badge color="teal" variant="dot">Đang có bản xuất bản</Badge>}
        </Group>
        <SegmentedControl
          value={locale}
          onChange={(value) => setLocale(value as PreviewLocale)}
          data={[
            { value: 'vi', label: 'Tiếng Việt' },
            { value: 'en', label: 'English' },
          ]}
          aria-label="Ngôn ngữ nội dung xem trước"
        />
      </Group>

      <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light">
        <Text size="sm">
          Vị trí <Code>{formatVector(detail.content.position, 0)}</Code> · Góc xoay{' '}
          <Code>{formatVector(detail.content.rotation, 0)}</Code> · Tỉ lệ <Code>{formatVector(detail.content.scale, 1)}</Code>.
          Tour hiện đặt hiện vật theo <strong>vị trí</strong>; góc xoay và tỉ lệ chưa được tour áp dụng nên preview cũng
          không áp. Chọn hiện vật trong phòng để đọc nội dung và hotspot theo ngôn ngữ đang chọn.
        </Text>
      </Alert>
      {roomQuery.isError && (
        <Alert color="yellow" variant="light">
          Phòng của hiện vật chưa công khai — preview chỉ hiển thị bản nháp, không có các hiện vật khác.
        </Alert>
      )}
      {modelQuery.isError && (
        <Alert color="yellow" variant="light">
          Không lấy được thông tin model đang gắn — hiện vật hiển thị bằng khối thay thế.
        </Alert>
      )}

      <div className={`${classes.stage} ${selected ? classes.stageDetails : ''}`}>
        <div className={classes.viewport}>
          {displays.length === 0 ? (
            <Center h="100%" mih={420}>
              <Loader />
            </Center>
          ) : (
            <ErrorBoundary fallback={sceneUnavailable}>
              <Suspense fallback={<Center mih={420}><Loader /></Center>}>
                <LazyMuseumScene
                  displays={displays}
                  selectedId={selected?.id ?? null}
                  onSelect={setSelectedId}
                  onClear={() => setSelectedId(null)}
                  fallback={sceneUnavailable}
                />
              </Suspense>
            </ErrorBoundary>
          )}
        </div>
        {selected && <ExhibitDetailPanel display={selected} onClose={() => setSelectedId(null)} />}
      </div>
    </Stack>
  );
}
