import { useRef, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Drawer,
  FileButton,
  Flex,
  Grid,
  Group,
  Image,
  Modal,
  Progress,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconAlertTriangle,
  IconBadgeCc,
  IconCube,
  IconEdit,
  IconEye,
  IconMusic,
  IconSearch,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiException } from '@/core/api/api-error';
import { formatBytes, hasMediaRights, MEDIA_ACCEPT, uploadSizeError } from '@/helpers/mediaLibrary';
import type { MediaItem, MediaKind, MediaProcessingState } from '@/services/media.service';
import { MEDIA_KIND_LABEL, MEDIA_STATE_LABEL, mediaService } from '@/services/media.service';
import { BulkActionBar, BulkDeleteFailures, Column, DataTable } from '@/shared/components/data';
import { useBulkDelete } from '@/shared/hooks/useBulkDelete';
import { useRowSelection } from '@/shared/hooks/useRowSelection';
import { confirmAction, notify } from '@/shared/components/feedback';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { MediaPreview } from '@/shared/components/media/MediaPreview';
import { UploadDropzone } from '@/components/cms/UploadDropzone';
import { StorageQuotaBar } from '@/components/cms/StorageQuotaBar';

const PAGE_SIZE = 15;

const KIND_OPTIONS = (Object.keys(MEDIA_KIND_LABEL) as MediaKind[]).map((value) => ({
  value,
  label: MEDIA_KIND_LABEL[value],
}));

const STATE_COLOR: Record<MediaProcessingState, string> = {
  pending: 'gray',
  ready: 'teal',
  failed: 'red',
  quarantined: 'orange',
};

interface MetadataFormValues {
  altText: string;
  source: string;
  author: string;
  license: string;
}

/** Chuỗi rỗng sau trim → `null` (xóa giá trị), để back-end không lưu khoảng trắng. */
const orNull = (value: string) => value.trim() || null;

function KindIcon({ kind }: { kind: MediaKind }) {
  switch (kind) {
    case 'model':
      return <IconCube size={22} />;
    case 'audio':
      return <IconMusic size={22} />;
    case 'subtitle':
      return <IconBadgeCc size={22} />;
    default:
      return null;
  }
}

function Thumbnail({ media }: { media: MediaItem }) {
  if (media.kind === 'image' && media.url) {
    return <Image src={media.url} alt="" w={48} h={48} fit="cover" radius="xs" />;
  }
  return (
    <Center w={48} h={48} bg="gray.1" c="gray.7" style={{ borderRadius: 4 }} aria-hidden>
      <KindIcon kind={media.kind} />
    </Center>
  );
}

/** Thư viện media CMS: upload qua pipeline kiểm định dạng, sửa quyền sử dụng, xem trước, xóa theo BR-21. */
export function MediaPage() {
  const queryClient = useQueryClient();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const resetUploadRef = useRef<() => void>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<MediaKind | null>(null);
  const [stateFilter, setStateFilter] = useState<MediaProcessingState | null>(null);

  const [uploadKind, setUploadKind] = useState<MediaKind>('image');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [previewing, setPreviewing] = useState<MediaItem | null>(null);
  const [editing, setEditing] = useState<MediaItem | null>(null);

  const mediaQuery = useQuery({
    queryKey: ['admin-media', page, search, kindFilter, stateFilter],
    queryFn: () =>
      mediaService.list({
        page,
        pageSize: PAGE_SIZE,
        q: search.trim() || undefined,
        kind: kindFilter ?? undefined,
        state: stateFilter ?? undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const form = useForm<MetadataFormValues>({
    initialValues: { altText: '', source: '', author: '', license: '' },
    validate: {
      altText: (v) => (v.length > 240 ? 'Tối đa 240 ký tự' : null),
      source: (v) => (v.length > 500 ? 'Tối đa 500 ký tự' : null),
      author: (v) => (v.length > 200 ? 'Tối đa 200 ký tự' : null),
      license: (v) => (v.length > 1000 ? 'Tối đa 1000 ký tự' : null),
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-media'] });
  const selection = useRowSelection(`${page}|${search}|${kindFilter ?? ''}|${stateFilter ?? ''}`);
  // Media đang được dùng (BR-21) chỉ back-end biết: không khóa trước, lý do hiện trong danh sách bị chặn.
  const bulk = useBulkDelete({
    removeMany: mediaService.removeMany,
    noun: 'media',
    nameOf: (id) => mediaQuery.data?.items.find((media) => media.id === id)?.originalName ?? undefined,
    onSuccess: selection.clear,
    onSettled: invalidate,
  });

  const openEdit = (media: MediaItem) => {
    setEditing(media);
    form.setValues({
      altText: media.altText ?? '',
      source: media.source ?? '',
      author: media.author ?? '',
      license: media.license ?? '',
    });
    form.resetDirty();
  };

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      mediaService.upload(file, { kind: uploadKind, onProgress: setUploadProgress }),
    onMutate: () => {
      setUploadError(null);
      setUploadProgress(0);
    },
    onSuccess: (media) => {
      notify.success(`Đã tải lên "${media.originalName ?? media.id}". Hãy bổ sung nguồn, tác giả và giấy phép.`);
      void invalidate();
      openEdit(media);
    },
    onError: (err) => {
      // 413 (quá dung lượng), 422 (sai định dạng / bị cách ly): back-end trả thông điệp cụ thể.
      setUploadError(err instanceof ApiException ? err.message : 'Tải lên thất bại, vui lòng thử lại');
    },
    onSettled: () => {
      setUploadProgress(null);
      resetUploadRef.current?.();
    },
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: MetadataFormValues }) =>
      mediaService.update(id, {
        altText: orNull(values.altText),
        source: orNull(values.source),
        author: orNull(values.author),
        license: orNull(values.license),
      }),
    onSuccess: () => {
      notify.success('Đã lưu thông tin media');
      setEditing(null);
      void invalidate();
    },
    onError: (err) => {
      if (err instanceof ApiException) form.setErrors(err.fieldErrors);
      notify.error(err instanceof Error ? err.message : 'Lưu thông tin media thất bại');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mediaService.delete(id),
    onSuccess: async () => {
      notify.success('Đã xóa media');
      await invalidate();
      titleRef.current?.focus();
    },
    onError: (err) => {
      // 409 (BR-21): media đang được hiện vật đã xuất bản / bản chờ duyệt sử dụng.
      notify.error(err instanceof Error ? err.message : 'Xóa media thất bại');
    },
  });

  const handleFile = (file: File | null) => {
    if (!file) return;
    const sizeError = uploadSizeError(file.size, uploadKind);
    if (sizeError) {
      setUploadError(sizeError);
      resetUploadRef.current?.();
      return;
    }
    uploadMutation.mutate(file);
  };

  const handleDelete = (media: MediaItem) => {
    confirmAction({
      message: `Xóa "${media.originalName ?? media.id}"? Media đang được hiện vật đã xuất bản hoặc bản chờ duyệt sử dụng sẽ không xóa được.`,
      danger: true,
      confirmLabel: 'Xóa media',
      onConfirm: () => deleteMutation.mutate(media.id),
    });
  };

  const columns: Column<MediaItem>[] = [
    {
      key: 'preview',
      header: '',
      width: 64,
      render: (m) => <Thumbnail media={m} />,
    },
    {
      key: 'name',
      header: 'Tệp',
      render: (m) => (
        <Stack gap={2}>
          <Text size="sm" fw={600} lineClamp={1}>
            {m.originalName ?? 'Không rõ tên'}
          </Text>
          <Text size="xs" c="dimmed">
            {m.mimeType} · {formatBytes(m.sizeBytes)}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'kind',
      header: 'Loại',
      render: (m) => (
        <Badge variant="light" size="sm">
          {MEDIA_KIND_LABEL[m.kind]}
        </Badge>
      ),
    },
    {
      key: 'state',
      header: 'Trạng thái',
      render: (m) => (
        <Badge color={STATE_COLOR[m.processingState]} variant="light" size="sm">
          {MEDIA_STATE_LABEL[m.processingState]}
        </Badge>
      ),
    },
    {
      key: 'rights',
      header: 'Quyền sử dụng',
      render: (m) =>
        hasMediaRights(m) ? (
          <Badge color="teal" variant="dot" size="sm">Đủ</Badge>
        ) : (
          <Tooltip label="Cần nguồn, tác giả và giấy phép trước khi gửi duyệt hiện vật dùng media này">
            <Badge color="orange" variant="dot" size="sm">Thiếu</Badge>
          </Tooltip>
        ),
    },
    {
      key: 'createdAt',
      header: 'Ngày tải lên',
      render: (m) => (
        <Text size="xs" c="dimmed">
          {new Date(m.createdAt).toLocaleString('vi-VN')}
        </Text>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (m) => (
        <Group gap={6} justify="flex-end" wrap="nowrap">
          <Tooltip label="Xem trước">
            <ActionIcon variant="subtle" color="blue" aria-label="Xem trước" onClick={() => setPreviewing(m)}>
              <IconEye size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Sửa mô tả & quyền sử dụng">
            <ActionIcon variant="subtle" aria-label="Sửa thông tin" onClick={() => openEdit(m)}>
              <IconEdit size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Xóa media">
            <ActionIcon variant="subtle" color="red" aria-label="Xóa" onClick={() => handleDelete(m)}>
              <IconTrash size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        titleRef={titleRef}
        title="Media"
        description="Thư viện model 3D, ảnh, audio thuyết minh và phụ đề dùng cho hiện vật"
      />

      <StorageQuotaBar />

      <Card withBorder p="md" mb="md" radius="sm">
        <Text fw={600} size="sm" mb="xs">
          Tải lên media mới
        </Text>
        <Group align="flex-end" gap="sm">
          <Select
            label="Loại media"
            data={KIND_OPTIONS}
            value={uploadKind}
            onChange={(value) => value && setUploadKind(value as MediaKind)}
            allowDeselect={false}
            w={220}
          />
          <FileButton onChange={handleFile} accept={MEDIA_ACCEPT[uploadKind]} resetRef={resetUploadRef}>
            {(props) => (
              <Button {...props} leftSection={<IconUpload size={16} />} loading={uploadMutation.isPending}>
                Chọn tệp & tải lên
              </Button>
            )}
          </FileButton>
          <Text size="xs" c="dimmed">
            GLB ≤ 10 MB (tài nguyên nhúng) · Ảnh JPEG/PNG/WebP ≤ 2 MB · MP3 ≤ 10 MB · WebVTT ≤ 1 MB
          </Text>
        </Group>
        <div style={{ marginTop: 12 }}>
          <UploadDropzone onFile={handleFile} disabled={uploadMutation.isPending}
            hint={`Hoặc thả tệp ${MEDIA_KIND_LABEL[uploadKind]} (${MEDIA_ACCEPT[uploadKind]}) vào vùng này`} />
        </div>
        {uploadProgress !== null && (
          <Progress value={uploadProgress * 100} mt="sm" size="sm" animated aria-label="Tiến độ tải lên" />
        )}
        {uploadError && (
          <Alert
            mt="sm"
            color="red"
            variant="light"
            icon={<IconAlertTriangle size={16} />}
            withCloseButton
            onClose={() => setUploadError(null)}
          >
            {uploadError}
          </Alert>
        )}
      </Card>

      <Card withBorder p="md" mb="md" radius="sm">
        <Grid gutter="md" align="flex-end">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              leftSection={<IconSearch size={16} />}
              placeholder="Tìm theo tên tệp, mô tả, nguồn, tác giả..."
              value={search}
              onChange={(e) => {
                setSearch(e.currentTarget.value);
                setPage(1);
              }}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <Select
              placeholder="Tất cả loại"
              data={KIND_OPTIONS}
              value={kindFilter}
              clearable
              onChange={(value) => {
                setKindFilter(value as MediaKind | null);
                setPage(1);
              }}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <Select
              placeholder="Tất cả trạng thái"
              data={(Object.keys(MEDIA_STATE_LABEL) as MediaProcessingState[]).map((value) => ({
                value,
                label: MEDIA_STATE_LABEL[value],
              }))}
              value={stateFilter}
              clearable
              onChange={(value) => {
                setStateFilter(value as MediaProcessingState | null);
                setPage(1);
              }}
            />
          </Grid.Col>
        </Grid>
      </Card>

      <BulkActionBar count={selection.selectedIds.length} onClear={selection.clear}
        onDelete={() => bulk.confirmDelete(selection.selectedIds)} loading={bulk.isPending} />
      <BulkDeleteFailures failures={bulk.failures} onClose={bulk.dismissFailures} />
      <Card withBorder p={0} radius="sm">
        <DataTable
          columns={columns}
          data={mediaQuery.data?.items ?? []}
          rowKey={(m) => m.id}
          selection={{
            selectedIds: selection.selectedIds,
            onChange: selection.setSelectedIds,
            rowLabel: (m) => m.originalName ?? m.id,
          }}
          total={mediaQuery.data?.total ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          loading={mediaQuery.isLoading}
          emptyText="Chưa có media nào phù hợp với bộ lọc."
        />
      </Card>

      <Modal
        opened={!!previewing}
        onClose={() => setPreviewing(null)}
        title={previewing?.originalName ?? 'Xem trước media'}
        size="lg"
      >
        {previewing && (
          <Stack gap="sm">
            <MediaPreview kind={previewing.kind} url={previewing.url} altText={previewing.altText} height={360} />
            <Text size="xs" c="dimmed">
              {MEDIA_KIND_LABEL[previewing.kind]} · {formatBytes(previewing.sizeBytes)} · SHA-256{' '}
              {previewing.checksumSha256.slice(0, 12)}…
            </Text>
          </Stack>
        )}
      </Modal>

      <Drawer
        opened={!!editing}
        onClose={() => setEditing(null)}
        title={<Text fw={700}>Thông tin media</Text>}
        position="right"
        size="md"
      >
        {editing && (
          <form onSubmit={form.onSubmit((values) => saveMutation.mutate({ id: editing.id, values }))}>
            <Stack gap="sm">
              <MediaPreview kind={editing.kind} url={editing.url} altText={editing.altText} height={200} />
              <Text size="xs" c="dimmed">
                {editing.originalName} · {MEDIA_KIND_LABEL[editing.kind]} · {formatBytes(editing.sizeBytes)}
              </Text>
              <Alert variant="light" color="blue" p="xs">
                <Text size="xs">
                  Nguồn, tác giả và giấy phép là bắt buộc trước khi gửi duyệt hiện vật dùng media này (FR-97). Tệp
                  đã tải lên không thể thay thế — muốn đổi tệp, hãy tải lên media mới.
                </Text>
              </Alert>
              <TextInput label="Mô tả ngắn (alt text chung)" maxLength={240} {...form.getInputProps('altText')} />
              <TextInput
                label="Nguồn"
                placeholder="Ví dụ: Bảo tàng Lịch sử Quốc gia"
                maxLength={500}
                {...form.getInputProps('source')}
              />
              <TextInput label="Tác giả" maxLength={200} {...form.getInputProps('author')} />
              <Textarea
                label="Giấy phép / điều kiện sử dụng"
                placeholder="Ví dụ: CC BY 4.0, hoặc 'Đã được bảo tàng cho phép sử dụng trên web'"
                autosize
                minRows={2}
                maxLength={1000}
                {...form.getInputProps('license')}
              />
              <Flex justify="flex-end" gap="sm" mt="sm">
                <Button variant="default" onClick={() => setEditing(null)}>
                  Hủy
                </Button>
                <Button type="submit" loading={saveMutation.isPending}>
                  Lưu
                </Button>
              </Flex>
            </Stack>
          </form>
        )}
      </Drawer>
    </>
  );
}
