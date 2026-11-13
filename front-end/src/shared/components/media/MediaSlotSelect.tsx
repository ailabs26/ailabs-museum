import { Anchor, Select, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatBytes, hasMediaRights } from '@/helpers/mediaLibrary';
import type { MediaKind } from '@/helpers/mediaLibrary';
import { mediaService } from '@/services/media.service';

export interface MediaSlotSelectProps {
  kind: MediaKind;
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
  description?: string;
}

/** Danh sách media sẵn sàng theo loại — dùng chung cho mọi slot cùng loại (cache theo kind). */
function useReadyMedia(kind: MediaKind) {
  return useQuery({
    queryKey: ['admin-media-options', kind],
    queryFn: () => mediaService.list({ kind, state: 'ready', pageSize: 100 }),
    staleTime: 30_000,
  });
}

/**
 * Chọn media cho một slot của hiện vật. Chỉ liệt kê media `ready` đúng loại (back-end vẫn kiểm
 * lại khi lưu). Media đang gắn nhưng không còn trong danh sách (đã xóa / chưa sẵn sàng) vẫn hiện
 * để người dùng thấy và gỡ.
 */
export function MediaSlotSelect({ kind, label, value, onChange, error, description }: MediaSlotSelectProps) {
  const { data, isLoading } = useReadyMedia(kind);
  const items = data?.items ?? [];
  const selected = items.find((media) => media.id === value);

  const options = items.map((media) => ({
    value: media.id,
    label: `${media.originalName ?? media.id.slice(0, 8)} · ${formatBytes(media.sizeBytes)}${hasMediaRights(media) ? '' : ' · thiếu quyền sử dụng'}`,
  }));
  if (value && !selected) {
    options.unshift({ value, label: `Media đang gắn (${value.slice(0, 8)}…) — không còn sẵn sàng` });
  }

  const rightsWarning =
    selected && !hasMediaRights(selected) ? (
      <Text size="xs" c="orange.8" mt={4}>
        Media này chưa có đủ nguồn/tác giả/giấy phép — gửi duyệt sẽ bị từ chối.{' '}
        <Anchor component={Link} to="/admin/media" size="xs">
          Bổ sung trong thư viện Media
        </Anchor>
      </Text>
    ) : null;

  return (
    <div>
      <Select
        label={label}
        description={description}
        placeholder={isLoading ? 'Đang tải danh sách…' : 'Chưa gắn media'}
        data={options}
        value={value}
        onChange={onChange}
        error={error}
        searchable
        clearable
        nothingFoundMessage="Không có media phù hợp — tải lên ở trang Media"
      />
      {rightsWarning}
    </div>
  );
}
