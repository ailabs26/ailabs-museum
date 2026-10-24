import { useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Code,
  Divider,
  Drawer,
  Flex,
  Grid,
  Group,
  Loader,
  NumberInput,
  Pagination,
  SegmentedControl,
  Select,
  SimpleGrid,
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
  IconCube,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconInfoCircle,
  IconLayoutGrid,
  IconListNumbers,
  IconMapPin,
  IconPhoto,
  IconPlus,
  IconSearch,
  IconSend,
  IconTable,
  IconTrash,
} from '@tabler/icons-react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ApiException } from '@/core/api/api-error';
import type { Page } from '@/core/api/api-response';
import { firstTabWithError, mapExhibitErrors } from '@/helpers/exhibitFormErrors';
import { resolveBilingualText, toHotspotFormValues, toHotspotPayload, validateHotspots } from '@/helpers/exhibitHotspots';
import type { HotspotFormValue } from '@/helpers/exhibitHotspots';
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
import { HotspotEditor } from '@/components/cms/HotspotEditor';
import { TourOrderModal } from '@/components/cms/TourOrderModal';
import { roomsService } from '@/services/rooms.service';
import { moderationService } from '@/services/moderation.service';
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
  hotspots: HotspotFormValue[];
}

type EditLoadState = 'ready' | 'loading' | 'error';

function deletionBlock(exhibit: ExhibitRow, revisions: ExhibitDetail['revisions'] = []): string | null {
  if (exhibit.publishedRevisionId || exhibit.visibility === 'visible' || exhibit.revisionState === 'approved' || revisions.some(r => r.state === 'approved')) {
    return 'Hiện vật có lịch sử xuất bản hoặc phê duyệt nên không thể xóa vĩnh viễn. Có thể ẩn hiện vật đang công khai khỏi bảo tàng.';
  }
  return exhibit.revisionState === 'in_review' || revisions.some(r => r.state === 'in_review')
    ? 'Hiện vật có phiên bản đang chờ kiểm duyệt, không thể xóa.' : null;
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
  const [view, setView] = useState<'table' | 'card'>('table');

  const [editing, setEditing] = useState<ExhibitRow | null>(null);
  const [opened, drawer] = useDisclosure(false);
  const [formTab, setFormTab] = useState<ExhibitFormTab>('basic');
  const [editLoadState, setEditLoadState] = useState<EditLoadState>('ready');
  const editSessionRef = useRef(0);
  const actionRequestRef = useRef(0);
  const actionBusyRef = useRef(false);
  const [isActionBusy, setIsActionBusy] = useState(false);

  useEffect(() => () => { editSessionRef.current++; actionRequestRef.current++; }, []);

  const [tourOrderOpened, tourOrder] = useDisclosure(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpened, detailDrawer] = useDisclosure(false);

  const canCreate = hasPermission(PERMISSIONS.EXHIBIT_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.EXHIBIT_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.EXHIBIT_UPDATE);
  const canSubmit = hasPermission(PERMISSIONS.REVISION_SUBMIT);
  const canHide = hasPermission(PERMISSIONS.REVISION_HIDE);

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
      hotspots: [],
    },
    validate: (values) => {
      const errors: Record<string, string> = validateHotspots(values.hotspots);
      if (values.roomId.trim().length === 0) errors.roomId = 'Vui lòng chọn phòng trưng bày';
      if (values.nameVi.trim().length === 0) errors.nameVi = 'Tên tiếng Việt không được để trống';
      if (values.scaleX <= 0) errors.scaleX = 'Scale X phải lớn hơn 0';
      if (values.scaleY <= 0) errors.scaleY = 'Scale Y phải lớn hơn 0';
      if (values.scaleZ <= 0) errors.scaleZ = 'Scale Z phải lớn hơn 0';
      return errors;
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
    // Mọi chi tiết đã cache (drawer chi tiết, hotspot nạp cho form sửa) đều có thể đã cũ.
    queryClient.invalidateQueries({ queryKey: ['admin-exhibit-detail'] });
  };

  const saveMutation = useMutation({
    mutationFn: ({ values, id }: { values: ExhibitFormValues; id: string | null; session: number }) => {
      if (editLoadState !== 'ready' || (editing ? !canUpdate || editing.revisionState === 'in_review' : !canCreate)) {
        throw new Error('Hiện vật chưa sẵn sàng để lưu.');
      }
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
        hotspots: toHotspotPayload(values.hotspots),
      };

      if (id) {
        return exhibitsService.update(id, payload as UpdateExhibitInput);
      }
      return exhibitsService.create(payload);
    },
    onSuccess: async (saved, { id, session }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['admin-exhibits'] }),
        queryClient.cancelQueries({ queryKey: ['admin-exhibit-detail', saved.id], exact: true }),
      ]);
      queryClient.setQueriesData<Page<ExhibitRow>>({ queryKey: ['admin-exhibits'] }, (cached) => {
        if (!cached || !cached.items.some(item => item.id === saved.id)) return cached;
        return { ...cached, items: cached.items.map(item => item.id === saved.id ? saved : item) };
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-exhibit-detail', saved.id], exact: true, refetchType: 'none' });
      void queryClient.invalidateQueries({ queryKey: ['admin-exhibits'] });
      notify.success(
        id
          ? `Đã lưu bản nháp hiện vật "${getDisplayText(saved.content.name, 'vi')}"`
          : `Đã tạo bản nháp hiện vật mới "${getDisplayText(saved.content.name, 'vi')}"`,
      );
      if (editSessionRef.current === session) {
        editSessionRef.current++;
        drawer.close();
      }
    },
    onError: (err, { session }) => {
      if (err instanceof ApiException) {
        if (err.status === 409) {
          notify.error(err.message);
          return;
        }
        if (editSessionRef.current === session) showFieldErrors(err);
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
    mutationFn: ({ exhibit }: { exhibit: ExhibitRow; session: number }) => exhibitsService.submitReview(exhibit.id),
    onSuccess: () => {
      notify.success('Đã gửi hiện vật vào hàng chờ kiểm duyệt (IN_REVIEW)');
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['moderation', 'queue'] });
    },
    onError: (err, { exhibit, session: submittedSession }) => {
      // 422 từ cổng Submit Review (§5.2, FR-97): mở form và chỉ ra đúng ô cần sửa.
      if (err instanceof ApiException && err.status === 422 && err.errors.length > 0 && canUpdate && editSessionRef.current === submittedSession) {
        const loading = openEdit(exhibit);
        const session = editSessionRef.current;
        void loading.then((loaded) => {
          if (loaded && editSessionRef.current === session) showFieldErrors(err);
        });
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
      if (page > 1 && exhibitsQuery.data?.items.length === 1) setPage(page - 1);
      await refreshLifecycleQueries();
      titleRef.current?.focus();
    },
    onError: (err) => {
      notify.error(err instanceof Error ? err.message : 'Xóa hiện vật thất bại');
      void refreshLifecycleQueries();
    },
    onSettled: () => { actionBusyRef.current = false; setIsActionBusy(false); },
  });

  const refreshLifecycleQueries = () => Promise.all([
    ['admin-exhibits'], ['admin-exhibit-detail'], ['rooms'], ['rooms-all-select'],
    ['moderation'], ['museum-tour'], ['public-room'],
  ].map(queryKey => queryClient.invalidateQueries({ queryKey })));

  const hideMutation = useMutation({
    mutationFn: async (id: string) => {
      const detail = await exhibitsService.get(id);
      if (!canHide || detail.visibility !== 'visible' || !detail.publishedRevisionId) {
        throw new Error('Hiện vật không còn công khai hoặc bạn không có quyền ẩn. Vui lòng tải lại.');
      }
      return moderationService.hide(id, detail.version);
    },
    onSuccess: async () => {
      notify.success('Đã ẩn hiện vật khỏi bảo tàng. Lịch sử và media vẫn được giữ.');
      await refreshLifecycleQueries();
      titleRef.current?.focus();
    },
    onError: (error) => {
      notify.error(error instanceof Error ? error.message : 'Không ẩn được hiện vật');
      void refreshLifecycleQueries();
    },
    onSettled: () => { actionBusyRef.current = false; setIsActionBusy(false); },
  });

  const unhideMutation = useMutation({
    mutationFn: async (id: string) => {
      const detail = await exhibitsService.get(id);
      if (!canHide || detail.visibility !== 'hidden' || !detail.publishedRevisionId) {
        throw new Error('Hiện vật không còn ở trạng thái ẩn hoặc bạn không có quyền. Vui lòng tải lại.');
      }
      return moderationService.unhide(id, detail.version);
    },
    onSuccess: async () => {
      notify.success('Đã bỏ ẩn hiện vật. Bản đã xuất bản hiện đang hiển thị trong bảo tàng.');
      await refreshLifecycleQueries();
      titleRef.current?.focus();
    },
    onError: (error) => {
      notify.error(error instanceof Error ? error.message : 'Không bỏ ẩn được hiện vật');
      void refreshLifecycleQueries();
    },
    onSettled: () => { actionBusyRef.current = false; setIsActionBusy(false); },
  });

  const handleHide = (exhibit: ExhibitRow) => {
    if (!canHide || actionBusyRef.current) return;
    const request = ++actionRequestRef.current;
    confirmAction({
      message: 'Ẩn hiện vật khỏi trang công khai? Lịch sử, bản nháp và media vẫn được giữ.',
      confirmLabel: 'Ẩn khỏi bảo tàng',
      onConfirm: () => {
        if (request !== actionRequestRef.current || actionBusyRef.current) return;
        actionBusyRef.current = true; setIsActionBusy(true);
        hideMutation.mutate(exhibit.id);
      },
    });
  };

  const handleUnhide = (exhibit: ExhibitRow) => {
    if (!canHide || actionBusyRef.current) return;
    const request = ++actionRequestRef.current;
    confirmAction({
      message: 'Hiện lại bản đã xuất bản của hiện vật trên bảo tàng? Bản nháp và phiên bản đang chờ duyệt không bị thay đổi.',
      confirmLabel: 'Bỏ ẩn hiện vật',
      onConfirm: () => {
        if (request !== actionRequestRef.current || actionBusyRef.current) return;
        actionBusyRef.current = true; setIsActionBusy(true);
        unhideMutation.mutate(exhibit.id);
      },
    });
  };

  const openCreate = () => {
    if (saveMutation.isPending) return;
    actionRequestRef.current++;
    if (!deleteMutation.isPending && !hideMutation.isPending && !unhideMutation.isPending) { actionBusyRef.current = false; setIsActionBusy(false); }
    editSessionRef.current++;
    setEditing(null);
    setEditLoadState('ready');
    setFormTab('basic');
    form.reset();
    if (formRoomOptions.length > 0) {
      form.setFieldValue('roomId', formRoomOptions[0].value);
    }
    drawer.open();
  };

  const closeForm = () => {
    if (saveMutation.isPending) return;
    editSessionRef.current++;
    drawer.close();
  };

  const openEdit = (exhibit: ExhibitRow): Promise<boolean> => {
    if (saveMutation.isPending) return Promise.resolve(false);
    actionRequestRef.current++;
    if (!deleteMutation.isPending && !hideMutation.isPending && !unhideMutation.isPending) { actionBusyRef.current = false; setIsActionBusy(false); }
    const session = ++editSessionRef.current;
    setEditing(exhibit);
    setEditLoadState('loading');
    form.clearErrors();
    setFormTab('basic');
    drawer.open();
    return loadEditDetail(exhibit.id, session);
  };

  const loadEditDetail = async (id: string, session: number): Promise<boolean> => {
    const queryKey = ['admin-exhibit-detail', id];
    try {
      await queryClient.cancelQueries({ queryKey, exact: true });
      if (editSessionRef.current !== session) return false;
      const detail = await queryClient.fetchQuery({
        queryKey, queryFn: () => exhibitsService.get(id), staleTime: 0, retry: false,
      });
      if (editSessionRef.current !== session) return false;
      hydrateEditForm(detail);
      setEditing(detail);
      setEditLoadState('ready');
      return true;
    } catch {
      if (editSessionRef.current === session) setEditLoadState('error');
      return false;
    }
  };

  function hydrateEditForm(detail: ExhibitDetail) {
    const content = detail.content;
    const pos = content.position || { x: 0, y: 0, z: 0 };
    const rot = content.rotation || { x: 0, y: 0, z: 0 };
    const scale = content.scale || { x: 1, y: 1, z: 1 };

    form.setValues({
      roomId: detail.roomId,
      nameVi: getLocalizedText(content.name, 'vi'),
      nameEn: getLocalizedText(content.name, 'en'),
      descriptionVi: getLocalizedText(content.description, 'vi'),
      descriptionEn: getLocalizedText(content.description, 'en'),
      displayOrder: detail.displayOrder ?? 1,
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
      hotspots: toHotspotFormValues(detail.hotspots),
    });
    form.clearErrors();
  }

  const openDetail = (exhibit: ExhibitRow) => {
    actionRequestRef.current++;
    if (!deleteMutation.isPending && !hideMutation.isPending && !unhideMutation.isPending) { actionBusyRef.current = false; setIsActionBusy(false); }
    setDetailId(exhibit.id);
    detailDrawer.open();
  };

  const handleSubmitReview = (exhibit: ExhibitRow) => {
    confirmAction({
      message: `Bạn có chắc chắn muốn gửi hiện vật "${getDisplayText(exhibit.content.name, 'vi')}" đi kiểm duyệt?`,
      confirmLabel: 'Gửi kiểm duyệt',
      onConfirm: () => submitReviewMutation.mutate({ exhibit, session: editSessionRef.current }),
    });
  };

  const handleDelete = async (exhibit: ExhibitRow) => {
    if (!canDelete || actionBusyRef.current) return;
    const request = ++actionRequestRef.current;
    actionBusyRef.current = true; setIsActionBusy(true);
    try {
      const detail = await exhibitsService.get(exhibit.id);
      if (request !== actionRequestRef.current) return;
      const reason = deletionBlock(detail, detail.revisions);
      if (reason) { notify.error(reason); void refreshLifecycleQueries(); return; }
      confirmAction({
        message: `Xóa vĩnh viễn hiện vật "${getDisplayText(detail.content.name, 'vi')}" và toàn bộ revisions/hotspots? Media vẫn được giữ trong thư viện.`,
        danger: true,
        confirmLabel: 'Xóa vĩnh viễn bản nháp',
        onConfirm: () => {
          if (request !== actionRequestRef.current || actionBusyRef.current) return;
          actionBusyRef.current = true; setIsActionBusy(true);
          deleteMutation.mutate(detail.id);
        },
      });
    } catch (error) {
      if (request === actionRequestRef.current) notify.error(error instanceof Error ? error.message : 'Không tải được hiện vật');
    } finally {
      if (request === actionRequestRef.current) { actionBusyRef.current = false; setIsActionBusy(false); }
    }
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
          {r.status === 'published'
            ? 'Đã xuất bản'
            : r.visibility === 'hidden' && r.publishedRevisionId
              ? 'Đã xuất bản · Đang ẩn'
              : 'Bản nháp'}
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
        const deleteReason = deletionBlock(r);

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
                label={deleteReason ?? 'Xóa vĩnh viễn bản nháp hiện vật'}
              >
                <ActionIcon
                  variant="subtle"
                  aria-label={`Xóa hiện vật ${getDisplayText(r.content.name)}`}
                  color={deleteReason ? 'gray' : 'red'}
                  disabled={!!deleteReason || isActionBusy}
                  onClick={() => handleDelete(r)}
                >
                  <IconTrash size={18} />
                </ActionIcon>
              </Tooltip>
            )}
            {canHide && r.visibility === 'visible' && r.publishedRevisionId && (
              <Tooltip label="Ẩn khỏi bảo tàng, giữ lịch sử và media">
                <ActionIcon variant="subtle" color="gray" disabled={isActionBusy}
                  aria-label={`Ẩn hiện vật ${getDisplayText(r.content.name)}`} onClick={() => handleHide(r)}>
                  <IconEyeOff size={18} />
                </ActionIcon>
              </Tooltip>
            )}
            {canHide && r.visibility === 'hidden' && r.publishedRevisionId && (
              <Tooltip label="Bỏ ẩn bản đã xuất bản, giữ bản nháp và lịch sử">
                <ActionIcon variant="subtle" color="teal" disabled={isActionBusy}
                  aria-label={`Bỏ ẩn hiện vật ${getDisplayText(r.content.name)}`} onClick={() => handleUnhide(r)}>
                  <IconEye size={18} />
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
          <Group gap="xs">
            {canUpdate && (
              <Button variant="default" leftSection={<IconListNumbers size={16} />} onClick={tourOrder.open}>
                Thứ tự tour
              </Button>
            )}
            {canCreate && (
              <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
                Thêm hiện vật
              </Button>
            )}
          </Group>
        }
      />

      <TourOrderModal
        opened={tourOrderOpened}
        onClose={tourOrder.close}
        rooms={formRoomOptions}
        initialRoomId={queryRoomId}
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

      <Group justify="flex-end" mb="sm">
        <SegmentedControl size="xs" value={view} onChange={(v) => setView(v as 'table' | 'card')}
          data={[
            { value: 'table', label: <Center style={{ gap: 6 }}><IconTable size={14} /> Bảng</Center> },
            { value: 'card', label: <Center style={{ gap: 6 }}><IconLayoutGrid size={14} /> Thẻ</Center> },
          ]} />
      </Group>

      {view === 'table' ? (
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
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {(exhibitsQuery.data?.items ?? []).map((r) => {
              const deleteReason = deletionBlock(r);
              const isInReview = r.revisionState === 'in_review';
              return (
                <Card key={r.id} withBorder radius="md" p="md">
                  <Group justify="space-between" wrap="nowrap" mb={6}>
                    <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                      <Box style={{ width: 16, height: 16, flexShrink: 0,
                        borderRadius: r.content.placeholderShape === 'sphere' ? '50%' : 3,
                        backgroundColor: r.content.placeholderColor || '#8b7355' }} />
                      <Text fw={700} size="sm" lineClamp={1}>{getDisplayText(r.content.name) || 'Chưa đặt tên'}</Text>
                    </Group>
                    <Badge color={REVISION_STATE_COLOR[r.revisionState] ?? 'gray'} variant="light" size="sm">
                      {REVISION_STATE_LABEL[r.revisionState] ?? r.revisionState}
                    </Badge>
                  </Group>
                  <Group gap={6} mb="xs">
                    <Badge variant="light" color="blue" size="xs">{roomMap.get(r.roomId) ?? r.roomId.slice(0, 8)}</Badge>
                    <Badge color={r.status === 'published' ? 'teal' : 'gray'} variant={r.status === 'published' ? 'filled' : 'light'} size="xs">
                      {r.status === 'published' ? 'Đã xuất bản' : r.visibility === 'hidden' && r.publishedRevisionId ? 'Đã XB · Ẩn' : 'Bản nháp'}
                    </Badge>
                    <Badge variant="subtle" color="indigo" size="xs">{r.hotspotsCount} hotspot</Badge>
                    <Badge size="xs" variant="outline" color="dark">#{r.displayOrder}</Badge>
                  </Group>
                  <Group gap={4} justify="flex-end">
                    <Tooltip label="Xem chi tiết"><ActionIcon variant="subtle" color="blue" onClick={() => openDetail(r)}><IconEye size={18} /></ActionIcon></Tooltip>
                    {canUpdate && (
                      <Tooltip label={isInReview ? 'Đang chờ kiểm duyệt (BR-26)' : 'Chỉnh sửa'}>
                        <ActionIcon variant="subtle" disabled={isInReview} color={isInReview ? 'gray' : 'aura'} onClick={() => openEdit(r)}><IconEdit size={18} /></ActionIcon>
                      </Tooltip>
                    )}
                    {canSubmit && (r.revisionState === 'draft' || r.revisionState === 'rejected') && (
                      <Tooltip label="Gửi kiểm duyệt"><ActionIcon variant="subtle" color="yellow" onClick={() => handleSubmitReview(r)}><IconSend size={18} /></ActionIcon></Tooltip>
                    )}
                    {canHide && r.visibility === 'visible' && r.publishedRevisionId && (
                      <Tooltip label="Ẩn khỏi bảo tàng"><ActionIcon variant="subtle" color="gray" disabled={isActionBusy} onClick={() => handleHide(r)}><IconEyeOff size={18} /></ActionIcon></Tooltip>
                    )}
                    {canHide && r.visibility === 'hidden' && r.publishedRevisionId && (
                      <Tooltip label="Bỏ ẩn"><ActionIcon variant="subtle" color="teal" disabled={isActionBusy} onClick={() => handleUnhide(r)}><IconEye size={18} /></ActionIcon></Tooltip>
                    )}
                    {canDelete && (
                      <Tooltip label={deleteReason ?? 'Xóa bản nháp'}>
                        <ActionIcon variant="subtle" color={deleteReason ? 'gray' : 'red'} disabled={!!deleteReason || isActionBusy} onClick={() => handleDelete(r)}><IconTrash size={18} /></ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Card>
              );
            })}
          </SimpleGrid>
          {!exhibitsQuery.isLoading && (exhibitsQuery.data?.items.length ?? 0) === 0 && (
            <Text c="dimmed" ta="center" py="xl">Không tìm thấy hiện vật nào phù hợp với bộ lọc.</Text>
          )}
          {exhibitsQuery.data && exhibitsQuery.data.total > 15 && (
            <Group justify="center" mt="md">
              <Pagination value={page} total={Math.ceil(exhibitsQuery.data.total / 15)} onChange={setPage} />
            </Group>
          )}
        </>
      )}

      {/* Drawer Thêm / Chỉnh sửa hiện vật */}
      <Drawer
        opened={opened}
        onClose={closeForm}
        closeOnEscape={!saveMutation.isPending}
        closeOnClickOutside={!saveMutation.isPending}
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
        {editLoadState === 'loading' ? <Text role="status">Đang tải hiện vật…</Text>
          : editLoadState === 'error' ? <Alert color="red" role="alert" title="Không tải được hiện vật">
            <Text>Không thể tải bản nháp mới nhất. Vui lòng thử lại trước khi chỉnh sửa.</Text>
            <Button mt="sm" onClick={() => editing && void openEdit(editing)}>Thử lại</Button>
          </Alert>
          : editing?.revisionState === 'in_review' || (editing ? !canUpdate : !canCreate)
            ? <Alert role="alert">{editing?.revisionState === 'in_review' ? 'Hiện vật đang chờ duyệt, không thể chỉnh sửa.' : 'Bạn không có quyền chỉnh sửa hiện vật này.'}</Alert>
            : <>
        {/* noValidate: `required` gốc của trình duyệt chặn submit âm thầm khi ô lỗi nằm ở tab đang ẩn. */}
        <form
          noValidate
          onSubmit={form.onSubmit(
            (values) => {
              if (!saveMutation.isPending) saveMutation.mutate({ values, id: editing?.id ?? null, session: editSessionRef.current });
            },
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
                <Tabs.Tab value="hotspots" leftSection={<IconMapPin size={14} />}>
                   Hotspots ({form.values.hotspots.length})
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

              {/* Tab 4: Hotspots */}
              <Tabs.Panel value="hotspots">
                <HotspotEditor
                  form={form}
                  modelId={form.values.modelId}
                  ready
                />
              </Tabs.Panel>
            </Tabs>

            <Divider my="sm" />

            <Flex justify="flex-end" gap="sm">
              <Button variant="default" disabled={saveMutation.isPending} onClick={closeForm}>
                Hủy bỏ
              </Button>
              <Button type="submit" loading={saveMutation.isPending}>
                {editing ? 'Lưu thay đổi' : 'Tạo bản nháp'}
              </Button>
            </Flex>
          </Stack>
        </form>
        </>}
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

              <Button
                component={Link}
                to={`/admin/exhibits/${detailQuery.data.id}/preview`}
                size="xs"
                variant="light"
                leftSection={<IconCube size={14} />}
                mb="xs"
              >
                Xem trước 3D trong phòng trưng bày
              </Button>

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
                    {[...detailQuery.data.hotspots].sort((a, b) => a.displayOrder - b.displayOrder).map((hs, index) => (
                      <Card key={hs.id} withBorder p="xs" radius="xs">
                        <Group justify="space-between" mb={2}>
                          <Text size="xs" fw={600}>
                            #{index + 1}: {resolveBilingualText(hs.label).vi || resolveBilingualText(hs.label).en}
                          </Text>
                          <Code fz="xs">
                            x:{hs.position.x}, y:{hs.position.y}, z:{hs.position.z}
                          </Code>
                        </Group>
                        <Text size="xs" c="dimmed">
                          {resolveBilingualText(hs.body).vi || resolveBilingualText(hs.body).en}
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
