import { useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Code,
  Divider,
  Drawer,
  Flex,
  Grid,
  Group,
  Loader,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import {
  IconAlertCircle,
  IconBox,
  IconClock,
  IconEdit,
  IconEye,
  IconInfoCircle,
  IconPhoto,
  IconPlus,
  IconSearch,
  IconSend,
  IconTrash,
} from '@tabler/icons-react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiException } from '@/core/api/api-error';
import { firstTabWithError, mapExhibitErrors } from '@/helpers/exhibitFormErrors';
import type { ExhibitFormTab } from '@/helpers/exhibitFormErrors';
import { hasMediaRights } from '@/helpers/mediaLibrary';
import { PERMISSIONS } from '@/core/auth/permissions';
import { useAuth } from '@/core/auth/use-auth';
import type {
  BilingualText,
  CreateExhibitInput,
  ExhibitDetail,
  ExhibitRow,
  ExhibitStatus,
  RevisionMediaSlot,
  RevisionState,
  UpdateExhibitInput,
} from '@/services/exhibits.service';
import { exhibitsService } from '@/services/exhibits.service';
import { roomsService } from '@/services/rooms.service';
import { Column, DataTable } from '@/shared/components/data';
import { confirmAction, notify } from '@/shared/components/feedback';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { MediaPreview } from '@/shared/components/media/MediaPreview';
import { MediaSlotSelect } from '@/shared/components/media/MediaSlotSelect';

interface ExhibitFormValues {
  roomId: string;
  nameVi: string;
  nameEn: string;
  descriptionVi: string;
  descriptionEn: string;
  displayOrder: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  placeholderShape: string;
  placeholderColor: string;
  modelId: string | null;
  imageId: string | null;
  audioViId: string | null;
  audioEnId: string | null;
  subtitleViId: string | null;
  subtitleEnId: string | null;
  altTextVi: string;
  altTextEn: string;
  transcriptVi: string;
  transcriptEn: string;
}

type MediaSlotField = 'modelId' | 'imageId' | 'audioViId' | 'audioEnId' | 'subtitleViId' | 'subtitleEnId';

/** Thứ tự & nhãn slot trong panel xem trước (khớp 6 slot của revision). */
const PREVIEW_SLOTS: { slot: RevisionMediaSlot; label: string }[] = [
  { slot: 'model', label: 'Model 3D' },
  { slot: 'image', label: 'Hình ảnh' },
  { slot: 'audioVi', label: 'Audio thuyết minh (Tiếng Việt)' },
  { slot: 'audioEn', label: 'Audio thuyết minh (English)' },
  { slot: 'subtitleVi', label: 'Phụ đề (Tiếng Việt)' },
  { slot: 'subtitleEn', label: 'Phụ đề (English)' },
];

/** Hai ô trống → `null` (xóa trên server); ngược lại gửi bản đã trim, bỏ ngôn ngữ rỗng. */
function toBilingual(vi: string, en: string): BilingualText | null {
  const value = { vi: vi.trim() || undefined, en: en.trim() || undefined };
  return value.vi || value.en ? value : null;
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả xuất bản' },
  { value: 'draft', label: 'Bản nháp (draft)' },
  { value: 'published', label: 'Đã xuất bản (published)' },
];

const SHAPE_OPTIONS = [
  { value: 'box', label: 'Khối hộp chữ nhật (Box)' },
  { value: 'sphere', label: 'Khối cầu (Sphere)' },
  { value: 'cylinder', label: 'Khối trụ (Cylinder)' },
  { value: 'cone', label: 'Khối nón (Cone)' },
  { value: 'torus', label: 'Khối xuyến (Torus)' },
];

const REVISION_STATE_COLOR: Record<RevisionState, string> = {
  draft: 'gray',
  in_review: 'yellow',
  approved: 'teal',
  rejected: 'red',
};

const REVISION_STATE_LABEL: Record<RevisionState, string> = {
  draft: 'Bản nháp',
  in_review: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Bị từ chối',
};

function getDisplayText(val: unknown, lang: 'vi' | 'en' = 'vi'): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, string>;
    return obj[lang] || obj.vi || obj.en || '';
  }
  return String(val);
}

/** Lấy đúng một ngôn ngữ (không lấy ngôn ngữ kia thay thế) — chuỗi thuần coi là tiếng Việt. */
function getLocalizedText(val: unknown, lang: 'vi' | 'en'): string {
  if (typeof val === 'string') return lang === 'vi' ? val : '';
  if (val && typeof val === 'object') {
    const text = (val as Record<string, unknown>)[lang];
    return typeof text === 'string' ? text : '';
  }
  return '';
}

/** Một slot media trong panel xem trước của drawer chi tiết. */
function PreviewSlot({ detail, slot, label }: { detail: ExhibitDetail; slot: RevisionMediaSlot; label: string }) {
  const media = detail.media?.[slot] ?? null;
  if (!media) return null;
  const subtitle =
    slot === 'audioVi' ? detail.media?.subtitleVi : slot === 'audioEn' ? detail.media?.subtitleEn : null;
  const altText = slot === 'image' ? getLocalizedText(detail.content.altText, 'vi') || media.altText : null;
  return (
    <Card withBorder p="xs" radius="xs">
      <Group justify="space-between" mb={6} wrap="nowrap">
        <Stack gap={0}>
          <Text size="sm" fw={600}>{label}</Text>
          <Text size="xs" c="dimmed" lineClamp={1}>{media.originalName ?? media.id}</Text>
        </Stack>
        <Group gap={4} wrap="nowrap">
          {(media.isDeleted || media.processingState !== 'ready') && (
            <Badge size="xs" color="red" variant="light">Không khả dụng</Badge>
          )}
          <Badge size="xs" variant="dot" color={hasMediaRights(media) ? 'teal' : 'orange'}>
            {hasMediaRights(media) ? 'Đủ quyền sử dụng' : 'Thiếu quyền sử dụng'}
          </Badge>
        </Group>
      </Group>
      <MediaPreview
        kind={media.kind}
        url={media.url}
        altText={altText}
        subtitleUrl={subtitle?.url ?? null}
        subtitleLang={slot === 'audioEn' ? 'en' : 'vi'}
        height={slot === 'model' ? 260 : 200}
      />
    </Card>
  );
}

export function ExhibitsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const titleRef = useRef<HTMLHeadingElement>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roomFilter, setRoomFilter] = useState<string>('all');

  const [editing, setEditing] = useState<ExhibitRow | null>(null);
  const [opened, drawer] = useDisclosure(false);
  const [formTab, setFormTab] = useState<ExhibitFormTab>('basic');

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpened, detailDrawer] = useDisclosure(false);

  const canCreate = hasPermission(PERMISSIONS.EXHIBIT_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.EXHIBIT_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.EXHIBIT_UPDATE);
  const canSubmit = hasPermission(PERMISSIONS.REVISION_SUBMIT);

  // Danh sách phòng cho bộ lọc và form
  const roomsQuery = useQuery({
    queryKey: ['rooms-all-select'],
    queryFn: () => roomsService.list({ page: 1, pageSize: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const roomOptions = [
    { value: 'all', label: 'Tất cả phòng trưng bày' },
    ...(roomsQuery.data?.items.map((r) => ({
      value: r.id,
      label: `${r.name} (${r.slug})`,
    })) ?? []),
  ];

  const formRoomOptions =
    roomsQuery.data?.items.map((r) => ({
      value: r.id,
      label: `${r.name} (${r.slug})`,
    })) ?? [];

  const roomMap = new Map<string, string>(
    roomsQuery.data?.items.map((r) => [r.id, r.name]) ?? [],
  );

  const queryStatus =
    statusFilter !== 'all' ? (statusFilter as ExhibitStatus) : undefined;
  const queryRoomId = roomFilter !== 'all' ? roomFilter : undefined;

  // Danh sách hiện vật
  const exhibitsQuery = useQuery({
    queryKey: ['admin-exhibits', page, search, queryStatus, queryRoomId],
    queryFn: () =>
      exhibitsService.list({
        page,
        pageSize: 15,
        q: search.trim() || undefined,
        status: queryStatus,
        roomId: queryRoomId,
      }),
    placeholderData: keepPreviousData,
  });

  // Chi tiết 1 hiện vật khi xem
  const detailQuery = useQuery({
    queryKey: ['admin-exhibit-detail', detailId],
    queryFn: () => (detailId ? exhibitsService.get(detailId) : null),
    enabled: !!detailId && detailOpened,
  });

  const form = useForm<ExhibitFormValues>({
    initialValues: {
      roomId: '',
      nameVi: '',
      nameEn: '',
      descriptionVi: '',
      descriptionEn: '',
      displayOrder: 1,
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      placeholderShape: 'box',
      placeholderColor: '#8b7355',
      modelId: null,
      imageId: null,
      audioViId: null,
      audioEnId: null,
      subtitleViId: null,
      subtitleEnId: null,
      altTextVi: '',
      altTextEn: '',
      transcriptVi: '',
      transcriptEn: '',
    },
    validate: {
      roomId: (v) => (v.trim().length === 0 ? 'Vui lòng chọn phòng trưng bày' : null),
      nameVi: (v) => (v.trim().length === 0 ? 'Tên tiếng Việt không được để trống' : null),
      scaleX: (v) => (v <= 0 ? 'Scale X phải lớn hơn 0' : null),
      scaleY: (v) => (v <= 0 ? 'Scale Y phải lớn hơn 0' : null),
      scaleZ: (v) => (v <= 0 ? 'Scale Z phải lớn hơn 0' : null),
    },
  });

  // Mở "Thêm hiện vật" trước khi danh sách phòng tải xong: chọn phòng đầu tiên khi có dữ liệu.
  const firstRoomId = roomsQuery.data?.items[0]?.id;
  useEffect(() => {
    if (opened && !editing && !form.values.roomId && firstRoomId) form.setFieldValue('roomId', firstRoomId);
    // form object ổn định; chỉ chạy lại khi drawer/phòng thay đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, editing, firstRoomId]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-exhibits'] });
    if (detailId) {
      queryClient.invalidateQueries({ queryKey: ['admin-exhibit-detail', detailId] });
    }
  };

  const saveMutation = useMutation({
    mutationFn: (values: ExhibitFormValues) => {
      const payload: CreateExhibitInput = {
        roomId: values.roomId,
        name: {
          vi: values.nameVi.trim(),
          en: values.nameEn.trim() || undefined,
        },
        description: {
          vi: values.descriptionVi.trim(),
          en: values.descriptionEn.trim() || undefined,
        },
        displayOrder: values.displayOrder,
        position: {
          x: values.positionX,
          y: values.positionY,
          z: values.positionZ,
        },
        rotation: {
          x: values.rotationX,
          y: values.rotationY,
          z: values.rotationZ,
        },
        scale: {
          x: values.scaleX,
          y: values.scaleY,
          z: values.scaleZ,
        },
        placeholderShape: values.placeholderShape,
        placeholderColor: values.placeholderColor,
        // Slot: id = gắn/thay, null = tháo (file không bị xóa).
        modelId: values.modelId,
        imageId: values.imageId,
        audioViId: values.audioViId,
        audioEnId: values.audioEnId,
        subtitleViId: values.subtitleViId,
        subtitleEnId: values.subtitleEnId,
        altText: toBilingual(values.altTextVi, values.altTextEn),
        transcript: toBilingual(values.transcriptVi, values.transcriptEn),
      };

      if (editing) {
        return exhibitsService.update(editing.id, payload as UpdateExhibitInput);
      }
      return exhibitsService.create(payload);
    },
    onSuccess: (saved) => {
      notify.success(
        editing
          ? `Đã cập nhật hiện vật "${getDisplayText(saved.content.name, 'vi')}"`
          : `Đã tạo bản nháp hiện vật mới "${getDisplayText(saved.content.name, 'vi')}"`,
      );
      drawer.close();
      invalidate();
    },
    onError: (err) => {
      if (err instanceof ApiException) {
        if (err.status === 409) {
          notify.error(err.message);
          return;
        }
        showFieldErrors(err);
      }
      notify.error(err instanceof Error ? err.message : 'Lưu hiện vật thất bại');
    },
  });

  /** Gắn lỗi theo field của API vào form, chuyển tới tab có lỗi; lỗi không gắn được thì báo chung. */
  function showFieldErrors(err: ApiException) {
    const { fieldErrors, general, firstTab } = mapExhibitErrors(err.errors);
    form.setErrors(fieldErrors);
    if (firstTab) setFormTab(firstTab);
    for (const message of general) notify.error(message, 'Cần sửa');
  }

  /** Props cho ô chọn media của một slot (Select của Mantine không dùng getInputProps cho null). */
  const slotProps = (field: MediaSlotField) => ({
    value: form.values[field],
    onChange: (value: string | null) => form.setFieldValue(field, value),
    error: form.errors[field] as string | undefined,
  });

  const submitReviewMutation = useMutation({
    mutationFn: (exhibit: ExhibitRow) => exhibitsService.submitReview(exhibit.id),
    onSuccess: () => {
      notify.success('Đã gửi hiện vật vào hàng chờ kiểm duyệt (IN_REVIEW)');
      invalidate();
    },
    onError: (err, exhibit) => {
      // 422 từ cổng Submit Review (§5.2, FR-97): mở form và chỉ ra đúng ô cần sửa.
      if (err instanceof ApiException && err.status === 422 && err.errors.length > 0 && canUpdate) {
        openEdit(exhibit);
        showFieldErrors(err);
        notify.error(
          `Chưa đủ điều kiện gửi duyệt (${err.errors.length} lỗi). Các ô cần sửa đã được đánh dấu.`,
          'Không gửi được',
        );
        return;
      }
      notify.error(
        err instanceof Error ? err.message : 'Gửi kiểm duyệt hiện vật thất bại',
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => exhibitsService.delete(id),
    onSuccess: async () => {
      notify.success('Đã xóa bản nháp hiện vật');
      await queryClient.invalidateQueries({ queryKey: ['admin-exhibits'] });
      if (detailId) void queryClient.invalidateQueries({ queryKey: ['admin-exhibit-detail', detailId] });
      titleRef.current?.focus();
    },
    onError: (err) => {
      notify.error(err instanceof Error ? err.message : 'Xóa hiện vật thất bại');
    },
  });

  const openCreate = () => {
    setEditing(null);
    setFormTab('basic');
    form.reset();
    if (formRoomOptions.length > 0) {
      form.setFieldValue('roomId', formRoomOptions[0].value);
    }
    drawer.open();
  };

  const openEdit = (exhibit: ExhibitRow) => {
    setEditing(exhibit);
    const content = exhibit.content;
    const pos = content.position || { x: 0, y: 0, z: 0 };
    const rot = content.rotation || { x: 0, y: 0, z: 0 };
    const scale = content.scale || { x: 1, y: 1, z: 1 };

    form.setValues({
      roomId: exhibit.roomId,
      nameVi: getDisplayText(content.name, 'vi'),
      nameEn: getDisplayText(content.name, 'en'),
      descriptionVi: getDisplayText(content.description, 'vi'),
      descriptionEn: getDisplayText(content.description, 'en'),
      displayOrder: exhibit.displayOrder ?? 1,
      positionX: pos.x,
      positionY: pos.y,
      positionZ: pos.z,
      rotationX: rot.x,
      rotationY: rot.y,
      rotationZ: rot.z,
      scaleX: scale.x,
      scaleY: scale.y,
      scaleZ: scale.z,
      placeholderShape: content.placeholderShape || 'box',
      placeholderColor: content.placeholderColor || '#8b7355',
      modelId: content.modelId ?? null,
      imageId: content.imageId ?? null,
      audioViId: content.audioViId ?? content.audioId ?? null,
      audioEnId: content.audioEnId ?? null,
      subtitleViId: content.subtitleViId ?? null,
      subtitleEnId: content.subtitleEnId ?? null,
      altTextVi: getLocalizedText(content.altText, 'vi'),
      altTextEn: getLocalizedText(content.altText, 'en'),
      transcriptVi: getLocalizedText(content.transcript, 'vi'),
      transcriptEn: getLocalizedText(content.transcript, 'en'),
    });
    form.clearErrors();
    setFormTab('basic');
    drawer.open();
  };

  const openDetail = (exhibit: ExhibitRow) => {
    setDetailId(exhibit.id);
    detailDrawer.open();
  };

  const handleSubmitReview = (exhibit: ExhibitRow) => {
    confirmAction({
      message: `Bạn có chắc chắn muốn gửi hiện vật "${getDisplayText(exhibit.content.name, 'vi')}" đi kiểm duyệt?`,
      confirmLabel: 'Gửi kiểm duyệt',
      onConfirm: () => submitReviewMutation.mutate(exhibit),
    });
  };

  const handleDelete = (exhibit: ExhibitRow) => {
    if (exhibit.status === 'published' || exhibit.visibility === 'visible') {
      notify.error(
        'Không thể xóa hiện vật đã từng xuất bản (Quy tắc nghiệp vụ BR-20). Vui lòng chuyển trạng thái ẩn thay vì xóa.',
      );
      return;
    }

    confirmAction({
      message: `Bạn có chắc chắn muốn xóa bản nháp hiện vật "${getDisplayText(exhibit.content.name, 'vi')}"? Hành động này sẽ cascade xóa toàn bộ hotspots và revisions liên quan.`,
      danger: true,
      confirmLabel: 'Xóa vĩnh viễn bản nháp',
      onConfirm: () => deleteMutation.mutate(exhibit.id),
    });
  };

  const columns: Column<ExhibitRow>[] = [
    {
      key: 'name',
      header: 'Hiện vật',
      render: (r) => {
        const nameVi = getDisplayText(r.content.name, 'vi');
        const nameEn = getDisplayText(r.content.name, 'en');
        return (
          <Group gap="sm" wrap="nowrap">
            <Box
              style={{
                width: 14,
                height: 14,
                borderRadius: r.content.placeholderShape === 'sphere' ? '50%' : 2,
                backgroundColor: r.content.placeholderColor || '#8b7355',
                flexShrink: 0,
              }}
            />
            <Stack gap={2}>
              <Text fw={600} size="sm">
                {nameVi || 'Chưa đặt tên'}
              </Text>
              {nameEn && (
                <Text size="xs" c="dimmed">
                  {nameEn}
                </Text>
              )}
            </Stack>
          </Group>
        );
      },
    },
    {
      key: 'roomId',
      header: 'Phòng trưng bày',
      render: (r) => (
        <Badge variant="light" color="blue" size="sm">
          {roomMap.get(r.roomId) ?? r.roomId.slice(0, 8)}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Xuất bản',
      render: (r) => (
        <Badge
          color={r.status === 'published' ? 'teal' : 'gray'}
          variant={r.status === 'published' ? 'filled' : 'light'}
          size="sm"
        >
          {r.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}
        </Badge>
      ),
    },
    {
      key: 'revisionState',
      header: 'Kiểm duyệt',
      render: (r) => (
        <Badge
          color={REVISION_STATE_COLOR[r.revisionState] ?? 'gray'}
          variant="light"
          size="sm"
        >
          {REVISION_STATE_LABEL[r.revisionState] ?? r.revisionState}
        </Badge>
      ),
    },
    {
      key: 'version',
      header: 'Phiên bản',
      render: (r) => (
        <Group gap={4}>
          <Badge size="xs" variant="outline" color="dark">
            Bản #{r.currentRevisionNo}
          </Badge>
          <Code fz="xs">v{r.version}</Code>
        </Group>
      ),
    },
    {
      key: 'hotspotsCount',
      header: 'Hotspots',
      render: (r) => (
        <Badge variant="subtle" color="indigo" size="sm">
          {r.hotspotsCount} điểm
        </Badge>
      ),
    },
    {
      key: 'displayOrder',
      header: 'Thứ tự',
      render: (r) => (
        <Text size="xs" fw={500} c="dimmed">
          #{r.displayOrder}
        </Text>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => {
        const isPublished = r.status === 'published';
        const isInReview = r.revisionState === 'in_review';

        return (
          <Group gap={6} justify="flex-end" wrap="nowrap">
            <Tooltip label="Xem chi tiết & lịch sử phiên bản">
              <ActionIcon variant="subtle" color="blue" onClick={() => openDetail(r)}>
                <IconEye size={18} />
              </ActionIcon>
            </Tooltip>

            {canUpdate && (
              <Tooltip
                label={
                  isInReview
                    ? 'Chặn sửa: Hiện vật đang trong hàng chờ kiểm duyệt (BR-26)'
                    : isPublished
                      ? 'Chỉnh sửa (sẽ tự động phân nhánh revision mới theo BR-21)'
                      : 'Chỉnh sửa bản nháp hiện vật'
                }
              >
                <ActionIcon
                  variant="subtle"
                  disabled={isInReview}
                  color={isInReview ? 'gray' : 'aura'}
                  onClick={() => openEdit(r)}
                >
                  <IconEdit size={18} />
                </ActionIcon>
              </Tooltip>
            )}

            {canSubmit && (r.revisionState === 'draft' || r.revisionState === 'rejected') && (
              <Tooltip label="Gửi bản nháp này đi kiểm duyệt">
                <ActionIcon
                  variant="subtle"
                  color="yellow"
                  onClick={() => handleSubmitReview(r)}
                >
                  <IconSend size={18} />
                </ActionIcon>
              </Tooltip>
            )}

            {canDelete && (
              <Tooltip
                label={
                  isPublished
                    ? 'Chặn xóa: Hiện vật đã từng xuất bản (SRS BR-20)'
                    : 'Xóa bản nháp hiện vật'
                }
              >
                <ActionIcon
                  variant="subtle"
                  color={isPublished ? 'gray' : 'red'}
                  disabled={isPublished}
                  onClick={() => handleDelete(r)}
                >
                  <IconTrash size={18} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        titleRef={titleRef}
        title="Hiện vật"
        description="Quản lý hiện vật 3D, tọa độ không gian, phiên bản nội dung song ngữ và điểm tương tác"
        actions={
          canCreate ? (
            <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
              Thêm hiện vật
            </Button>
          ) : undefined
        }
      />

      <Card withBorder p="md" mb="md" radius="sm">
        <Grid gutter="md" align="flex-end">
          <Grid.Col span={{ base: 12, sm: 5 }}>
            <TextInput
              leftSection={<IconSearch size={16} />}
              placeholder="Tìm kiếm hiện vật theo tên tiếng Việt / Anh..."
              value={search}
              onChange={(e) => {
                setSearch(e.currentTarget.value);
                setPage(1);
              }}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Select
              data={roomOptions}
              value={roomFilter}
              onChange={(val) => {
                setRoomFilter(val || 'all');
                setPage(1);
              }}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 3 }}>
            <Select
              data={STATUS_FILTER_OPTIONS}
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val || 'all');
                setPage(1);
              }}
            />
          </Grid.Col>
        </Grid>
      </Card>

      <Card withBorder p={0} radius="sm">
        <DataTable
          columns={columns}
          data={exhibitsQuery.data?.items ?? []}
          rowKey={(r) => r.id}
          total={exhibitsQuery.data?.total ?? 0}
          page={page}
          pageSize={15}
          onPageChange={setPage}
          loading={exhibitsQuery.isLoading}
          emptyText="Không tìm thấy hiện vật nào phù hợp với bộ lọc."
        />
      </Card>

      {/* Drawer Thêm / Chỉnh sửa hiện vật */}
      <Drawer
        opened={opened}
        onClose={drawer.close}
        title={
          <Group gap="xs">
            <IconBox size={20} />
            <Text fw={700}>
              {editing ? `Chỉnh sửa hiện vật #${editing.id.slice(0, 8)}` : 'Thêm hiện vật mới'}
            </Text>
          </Group>
        }
        position="right"
        size="xl"
      >
        <form
          onSubmit={form.onSubmit(
            (vals) => saveMutation.mutate(vals),
            // Lỗi validate nằm ở tab khác thì chuyển tới đó — không để nút "Lưu" im lặng.
            (errors) => {
              const tab = firstTabWithError(Object.keys(errors));
              if (tab) setFormTab(tab);
            },
          )}
        >
          <Stack gap="md">
            {editing && editing.status === 'published' && (
              <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light">
                <Text size="sm">
                  <strong>Quy tắc SRS BR-21:</strong> Hiện vật này đang ở trạng thái xuất bản
                  chính thức. Lưu thay đổi sẽ tự động <strong>phân nhánh (fork) một bản revision nháp mới</strong>{' '}
                  (Bản #{editing.currentRevisionNo + 1}), đảm bảo khách tham quan không bị gián đoạn.
                </Text>
              </Alert>
            )}

            <Tabs value={formTab} onChange={(value) => value && setFormTab(value as ExhibitFormTab)}>
              <Tabs.List mb="md">
                <Tabs.Tab value="basic">Thông tin cơ bản</Tabs.Tab>
                <Tabs.Tab value="transform">Tọa độ 3D & Khối tạm</Tabs.Tab>
                <Tabs.Tab value="media" leftSection={<IconPhoto size={14} />}>
                  Media & thuyết minh
                </Tabs.Tab>
              </Tabs.List>

              {/* Tab 1: Thông tin cơ bản */}
              <Tabs.Panel value="basic">
                <Stack gap="sm">
                  <Select
                    label="Phòng trưng bày"
                    placeholder="Chọn phòng chứa hiện vật"
                    data={formRoomOptions}
                    required
                    {...form.getInputProps('roomId')}
                  />

                  <Grid gutter="sm">
                    <Grid.Col span={6}>
                      <TextInput
                        label="Tên hiện vật (Tiếng Việt)"
                        data-autofocus
                        placeholder="Ví dụ: Trống đồng Đông Sơn"
                        required
                        {...form.getInputProps('nameVi')}
                      />
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <TextInput
                        label="Tên hiện vật (Tiếng Anh)"
                        placeholder="Ví dụ: Dong Son Bronze Drum"
                        {...form.getInputProps('nameEn')}
                      />
                    </Grid.Col>
                  </Grid>

                  <Textarea
                    label="Mô tả hiện vật (Tiếng Việt)"
                    placeholder="Mô tả chi tiết nguồn gốc, niên đại, chất liệu..."
                    minRows={3}
                    {...form.getInputProps('descriptionVi')}
                  />

                  <Textarea
                    label="Mô tả hiện vật (Tiếng Anh)"
                    placeholder="Detailed description in English..."
                    minRows={3}
                    {...form.getInputProps('descriptionEn')}
                  />

                  <NumberInput
                    label="Thứ tự hiển thị trong phòng"
                    min={0}
                    {...form.getInputProps('displayOrder')}
                  />
                </Stack>
              </Tabs.Panel>

              {/* Tab 2: Tọa độ 3D & Khối tạm */}
              <Tabs.Panel value="transform">
                <Stack gap="md">
                  <Card withBorder p="sm" radius="xs" bg="gray.0">
                    <Text fw={600} size="sm" mb="xs">
                      1. Vị trí 3D (Position — mét, Y hướng lên)
                    </Text>
                    <Grid gutter="xs">
                      <Grid.Col span={4}>
                        <NumberInput
                          label="X"
                          step={0.1}
                          decimalScale={2}
                          {...form.getInputProps('positionX')}
                        />
                      </Grid.Col>
                      <Grid.Col span={4}>
                        <NumberInput
                          label="Y"
                          step={0.1}
                          decimalScale={2}
                          {...form.getInputProps('positionY')}
                        />
                      </Grid.Col>
                      <Grid.Col span={4}>
                        <NumberInput
                          label="Z"
                          step={0.1}
                          decimalScale={2}
                          {...form.getInputProps('positionZ')}
                        />
                      </Grid.Col>
                    </Grid>
                  </Card>

                  <Card withBorder p="sm" radius="xs" bg="gray.0">
                    <Text fw={600} size="sm" mb="xs">
                      2. Góc xoay 3D (Rotation — radian)
                    </Text>
                    <Grid gutter="xs">
                      <Grid.Col span={4}>
                        <NumberInput
                          label="Rot X"
                          step={0.1}
                          decimalScale={2}
                          {...form.getInputProps('rotationX')}
                        />
                      </Grid.Col>
                      <Grid.Col span={4}>
                        <NumberInput
                          label="Rot Y"
                          step={0.1}
                          decimalScale={2}
                          {...form.getInputProps('rotationY')}
                        />
                      </Grid.Col>
                      <Grid.Col span={4}>
                        <NumberInput
                          label="Rot Z"
                          step={0.1}
                          decimalScale={2}
                          {...form.getInputProps('rotationZ')}
                        />
                      </Grid.Col>
                    </Grid>
                  </Card>

                  <Card withBorder p="sm" radius="xs" bg="gray.0">
                    <Text fw={600} size="sm" mb="xs">
                      3. Tỉ lệ 3D (Scale — từng trục lớn hơn 0)
                    </Text>
                    <Grid gutter="xs">
                      <Grid.Col span={4}>
                        <NumberInput
                          label="Scale X"
                          min={0.01}
                          step={0.1}
                          decimalScale={2}
                          {...form.getInputProps('scaleX')}
                        />
                      </Grid.Col>
                      <Grid.Col span={4}>
                        <NumberInput
                          label="Scale Y"
                          min={0.01}
                          step={0.1}
                          decimalScale={2}
                          {...form.getInputProps('scaleY')}
                        />
                      </Grid.Col>
                      <Grid.Col span={4}>
                        <NumberInput
                          label="Scale Z"
                          min={0.01}
                          step={0.1}
                          decimalScale={2}
                          {...form.getInputProps('scaleZ')}
                        />
                      </Grid.Col>
                    </Grid>
                  </Card>

                  <Grid gutter="sm">
                    <Grid.Col span={6}>
                      <Select
                        label="Hình khối tạm khi chưa có 3D Model"
                        data={SHAPE_OPTIONS}
                        {...form.getInputProps('placeholderShape')}
                      />
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <TextInput
                        label="Màu khối tạm (Mã Hex)"
                        placeholder="#8b7355"
                        {...form.getInputProps('placeholderColor')}
                      />
                    </Grid.Col>
                  </Grid>
                </Stack>
              </Tabs.Panel>

              {/* Tab 3: Media & thuyết minh */}
              <Tabs.Panel value="media">
                <Stack gap="md">
                  <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light">
                    <Text size="sm">
                      Chọn media đã tải lên ở trang <strong>Media</strong>. Khi gửi duyệt: media phải đủ nguồn, tác
                      giả, giấy phép; có ảnh thì cần alt text cả hai ngôn ngữ; mỗi audio cần lời thuyết minh và phụ đề
                      cùng ngôn ngữ. Bỏ chọn một slot chỉ tháo media khỏi hiện vật, không xóa tệp.
                    </Text>
                  </Alert>

                  <Card withBorder p="sm" radius="xs" bg="gray.0">
                    <Text fw={600} size="sm" mb="xs">
                      1. Model 3D & hình ảnh
                    </Text>
                    <Stack gap="xs">
                      <MediaSlotSelect kind="model" label="Model 3D (GLB)" {...slotProps('modelId')} />
                      <MediaSlotSelect kind="image" label="Hình ảnh hiện vật" {...slotProps('imageId')} />
                      <Grid gutter="xs">
                        <Grid.Col span={6}>
                          <TextInput
                            label="Alt text ảnh (Tiếng Việt)"
                            description="Bắt buộc khi có ảnh"
                            maxLength={240}
                            {...form.getInputProps('altTextVi')}
                          />
                        </Grid.Col>
                        <Grid.Col span={6}>
                          <TextInput
                            label="Alt text ảnh (Tiếng Anh)"
                            description="Required when an image is attached"
                            maxLength={240}
                            {...form.getInputProps('altTextEn')}
                          />
                        </Grid.Col>
                      </Grid>
                    </Stack>
                  </Card>

                  <Card withBorder p="sm" radius="xs" bg="gray.0">
                    <Text fw={600} size="sm" mb="xs">
                      2. Thuyết minh tiếng Việt
                    </Text>
                    <Stack gap="xs">
                      <MediaSlotSelect kind="audio" label="Audio thuyết minh (MP3)" {...slotProps('audioViId')} />
                      <MediaSlotSelect kind="subtitle" label="Phụ đề (WebVTT)" {...slotProps('subtitleViId')} />
                      <Textarea
                        label="Lời thuyết minh (transcript)"
                        autosize
                        minRows={3}
                        maxRows={10}
                        maxLength={10000}
                        {...form.getInputProps('transcriptVi')}
                      />
                    </Stack>
                  </Card>

                  <Card withBorder p="sm" radius="xs" bg="gray.0">
                    <Text fw={600} size="sm" mb="xs">
                      3. English narration
                    </Text>
                    <Stack gap="xs">
                      <MediaSlotSelect kind="audio" label="Audio guide (MP3)" {...slotProps('audioEnId')} />
                      <MediaSlotSelect kind="subtitle" label="Subtitles (WebVTT)" {...slotProps('subtitleEnId')} />
                      <Textarea
                        label="Transcript"
                        autosize
                        minRows={3}
                        maxRows={10}
                        maxLength={10000}
                        {...form.getInputProps('transcriptEn')}
                      />
                    </Stack>
                  </Card>
                </Stack>
              </Tabs.Panel>
            </Tabs>

            <Divider my="sm" />

            <Flex justify="flex-end" gap="sm">
              <Button variant="default" onClick={drawer.close}>
                Hủy bỏ
              </Button>
              <Button type="submit" loading={saveMutation.isPending}>
                {editing ? 'Lưu thay đổi' : 'Tạo bản nháp'}
              </Button>
            </Flex>
          </Stack>
        </form>
      </Drawer>

      {/* Drawer Xem Chi Tiết Hiện Vật & Lịch Sử Revisions */}
      <Drawer
        opened={detailOpened}
        onClose={detailDrawer.close}
        title={
          <Group gap="xs">
            <IconEye size={20} />
            <Text fw={700}>Chi tiết hiện vật & Lịch sử phiên bản</Text>
          </Group>
        }
        position="right"
        size="lg"
      >
        {detailQuery.isLoading && (
          <Flex justify="center" p="xl">
            <Loader size="md" />
          </Flex>
        )}

        {detailQuery.data && (
          <Stack gap="md">
            <Card withBorder p="sm" radius="xs">
              <Group justify="space-between" mb="xs">
                <Text fw={700} size="md">
                  {getDisplayText(detailQuery.data.content.name, 'vi')}
                </Text>
                <Badge
                  color={detailQuery.data.status === 'published' ? 'teal' : 'gray'}
                  variant="filled"
                >
                  {detailQuery.data.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}
                </Badge>
              </Group>

              <Text size="sm" c="dimmed" mb="xs">
                {getDisplayText(detailQuery.data.content.description, 'vi') || 'Chưa có mô tả'}
              </Text>

              <Divider my="xs" />

              <Grid gutter="xs">
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">
                    Phòng:
                  </Text>
                  <Text size="xs" fw={600}>
                    {detailQuery.data.room?.name ?? detailQuery.data.roomId}
                  </Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">
                    Trạng thái duyệt:
                  </Text>
                  <Badge
                    size="xs"
                    color={REVISION_STATE_COLOR[detailQuery.data.revisionState]}
                  >
                    {REVISION_STATE_LABEL[detailQuery.data.revisionState]}
                  </Badge>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">
                    Phiên bản hiện vật:
                  </Text>
                  <Text size="xs" fw={600}>
                    v{detailQuery.data.version} (Bản #{detailQuery.data.currentRevisionNo})
                  </Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">
                    Số Hotspots:
                  </Text>
                  <Text size="xs" fw={600}>
                    {detailQuery.data.hotspotsCount} điểm tương tác
                  </Text>
                </Grid.Col>
              </Grid>
            </Card>

            <Tabs defaultValue="media">
              <Tabs.List mb="xs">
                <Tabs.Tab value="media" leftSection={<IconPhoto size={14} />}>
                  Media & xem trước
                </Tabs.Tab>
                <Tabs.Tab value="revisions" leftSection={<IconClock size={14} />}>
                  Lịch sử Revisions ({detailQuery.data.revisions.length})
                </Tabs.Tab>
                <Tabs.Tab value="hotspots">
                  Hotspots ({detailQuery.data.hotspots.length})
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="media">
                {PREVIEW_SLOTS.some(({ slot }) => detailQuery.data?.media?.[slot]) ? (
                  <Stack gap="xs">
                    <Text size="xs" c="dimmed">
                      Xem trước theo bản nội dung đang hiển thị (cả bản nháp). Liên kết đã ký, hết hạn sau ít phút —
                      mở lại chi tiết để làm mới.
                    </Text>
                    {PREVIEW_SLOTS.map(({ slot, label }) => (
                      <PreviewSlot key={slot} detail={detailQuery.data!} slot={slot} label={label} />
                    ))}
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed" p="md" ta="center">
                    Hiện vật chưa gắn media nào. Sửa hiện vật → tab “Media & thuyết minh” để gắn.
                  </Text>
                )}
              </Tabs.Panel>

              <Tabs.Panel value="revisions">
                <Stack gap="xs">
                  {detailQuery.data.revisions.map((rev) => (
                    <Card key={rev.id} withBorder p="xs" radius="xs">
                      <Group justify="space-between" mb={4}>
                        <Group gap="xs">
                          <Badge size="sm" variant="outline" color="dark">
                            Bản #{rev.revisionNo}
                          </Badge>
                          <Badge
                            size="sm"
                            color={REVISION_STATE_COLOR[rev.state]}
                            variant="light"
                          >
                            {REVISION_STATE_LABEL[rev.state]}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed">
                          {new Date(rev.createdAt).toLocaleDateString('vi-VN')}
                        </Text>
                      </Group>

                      <Text size="xs" c="dimmed">
                        Người tạo: {rev.createdBy?.name || rev.createdById}
                      </Text>

                      {rev.reviewedBy && (
                        <Text size="xs" c="dimmed">
                          Người duyệt: {rev.reviewedBy.name} (
                          {rev.reviewedAt
                            ? new Date(rev.reviewedAt).toLocaleDateString('vi-VN')
                            : ''}
                          )
                        </Text>
                      )}

                      {rev.reason && (
                        <Alert
                          icon={<IconAlertCircle size={14} />}
                          color="red"
                          variant="light"
                          p="xs"
                          mt="xs"
                        >
                          <Text size="xs">Lý do từ chối: {rev.reason}</Text>
                        </Alert>
                      )}
                    </Card>
                  ))}
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="hotspots">
                {detailQuery.data.hotspots.length === 0 ? (
                  <Text size="sm" c="dimmed" p="md" ta="center">
                    Hiện vật chưa có điểm tương tác (hotspot) nào.
                  </Text>
                ) : (
                  <Stack gap="xs">
                    {detailQuery.data.hotspots.map((hs, index) => (
                      <Card key={hs.id} withBorder p="xs" radius="xs">
                        <Group justify="space-between" mb={2}>
                          <Text size="xs" fw={600}>
                            #{index + 1}: {getDisplayText(hs.label, 'vi')}
                          </Text>
                          <Code fz="xs">
                            x:{hs.position.x}, y:{hs.position.y}, z:{hs.position.z}
                          </Code>
                        </Group>
                        <Text size="xs" c="dimmed">
                          {getDisplayText(hs.body, 'vi')}
                        </Text>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Tabs.Panel>
            </Tabs>
          </Stack>
        )}
      </Drawer>
    </>
  );
}
