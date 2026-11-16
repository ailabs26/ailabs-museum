import { useEffect, useMemo } from 'react';
import { Alert, Badge, Group, Loader, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { resolveBilingualText } from '@/helpers/exhibitHotspots';
import { GALLERY_SLOTS, getSlotOccupancy, matchGallerySlot, pickFreeSlot, type GallerySlotDefinition, type SlotPosition } from '@/helpers/gallerySlots';
import { exhibitsService } from '@/services/exhibits.service';

/** Sắp theo mặt bằng: hàng trên là tường sau, hàng dưới là lối vào. */
const PLAN: (GallerySlotDefinition['id'] | null)[] = ['S02', null, 'S03', null, 'S01', null, 'S04', null, 'S05'];

/**
 * Chọn bục trưng bày cho hiện vật (Gallery Template V1). Bục chỉ là cách nhập tọa độ chuẩn:
 * payload vẫn là `position` XYZ, nên bản nháp/duyệt/xuất bản giữ nguyên quy trình.
 * Trạng thái Trống/Đã có lấy từ các hiện vật khác của phòng; chống trùng thật sự nằm ở server khi xuất bản.
 */
export function GallerySlotPicker({ roomId, exhibitId, position, autoAssign, isActive, onSelect }: {
  roomId: string;
  /** Hiện vật đang sửa: bục của chính nó không bị coi là đã chiếm. */
  exhibitId?: string;
  position: SlotPosition;
  /** Tạo mới hoặc vừa đổi phòng: tự chuyển sang bục trống đầu tiên, không mang vị trí từ phòng cũ. */
  autoAssign: boolean;
  /** Tab vị trí đang mở. Khi chỉ sửa nội dung (không đổi phòng) thì chưa cần tải trạng thái bục. */
  isActive: boolean;
  onSelect: (position: SlotPosition) => void;
}) {
  const roomQuery = useQuery({
    // Tiền tố `admin-exhibits`: mọi thao tác lưu/xóa/khôi phục hiện vật đều làm mới danh sách này.
    queryKey: ['admin-exhibits', 'gallery-slots', roomId],
    queryFn: () => exhibitsService.list({ roomId, page: 1, pageSize: 100, status: 'all' }),
    enabled: !!roomId && (autoAssign || isActive),
  });
  const occupancy = useMemo(() => getSlotOccupancy(
    (roomQuery.data?.items ?? []).filter((row) => row.id !== exhibitId)
      .map((row) => ({ id: row.id, name: resolveBilingualText(row.content.name).vi || row.id.slice(0, 8), position: row.content.position })),
  ), [roomQuery.data, exhibitId]);
  const selected = matchGallerySlot([position.x, position.y, position.z]);
  const isOrigin = position.x === 0 && position.y === 0 && position.z === 0;
  const isConflict = !!selected && occupancy.bySlot.has(selected.id);

  useEffect(() => {
    if (!autoAssign || !roomQuery.isSuccess || !(isConflict || (!selected && isOrigin))) return;
    const free = pickFreeSlot(occupancy.bySlot);
    if (free) onSelect({ x: free.position[0], y: free.position[1], z: free.position[2] });
    // `onSelect` đổi theo mỗi lần render của form; chỉ chạy lại khi dữ liệu phòng hoặc vị trí đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAssign, roomQuery.isSuccess, isConflict, selected, isOrigin, occupancy]);

  if (!roomId) return <Text size="sm" c="dimmed">Chọn phòng trưng bày trước khi chọn bục.</Text>;
  return (
    <Stack gap="xs">
      <Group justify="space-between" gap="xs">
        <Text size="xs" c="dimmed">Tường sau (biển tên phòng)</Text>
        {roomQuery.isFetching && <Loader size="xs" aria-label="Đang tải trạng thái bục" />}
      </Group>
      <SimpleGrid cols={3} spacing="xs" role="radiogroup" aria-label="Vị trí trưng bày">
        {PLAN.map((id, index) => {
          const slot = GALLERY_SLOTS.find((item) => item.id === id);
          if (!slot) return <div key={index} aria-hidden="true" />;
          const occupant = occupancy.bySlot.get(slot.id);
          const isSelected = selected?.id === slot.id;
          const isTaken = !!occupant && !isSelected;
          return (
            <UnstyledButton key={slot.id} role="radio" aria-checked={isSelected} disabled={isTaken} data-slot={slot.id}
              aria-label={`${slot.label} — ${occupant ? `đã có hiện vật: ${occupant.name}` : 'trống'}`}
              onClick={() => onSelect({ x: slot.position[0], y: slot.position[1], z: slot.position[2] })}
              style={{
                padding: 10, borderRadius: 6, minHeight: 76, textAlign: 'left', cursor: isTaken ? 'not-allowed' : 'pointer',
                border: `2px solid var(--mantine-color-${isSelected ? 'teal-7' : 'gray-4'})`,
                background: `var(--mantine-color-${isSelected ? 'teal-0' : isTaken ? 'gray-1' : 'white'})`, opacity: isTaken ? 0.7 : 1,
              }}>
              <Text size="sm" fw={600}>{slot.label}</Text>
              {isSelected ? <Badge size="xs" color={occupant ? 'red' : 'teal'} mt={4}>{occupant ? 'Đang chọn · trùng' : 'Đang chọn'}</Badge>
                : occupant ? <Badge size="xs" color="gray" mt={4}>Đã có hiện vật</Badge>
                  : <Badge size="xs" color="teal" variant="light" mt={4}>Trống</Badge>}
              {occupant && <Text size="xs" c="dimmed" lineClamp={1} mt={2}>{occupant.name}</Text>}
            </UnstyledButton>
          );
        })}
      </SimpleGrid>
      <Text size="xs" c="dimmed" ta="center">Lối vào</Text>
      {roomQuery.isError && <Alert color="orange" role="alert">Không tải được trạng thái các bục của phòng. Vẫn có thể chọn bục; hệ thống sẽ kiểm tra trùng khi xuất bản.</Alert>}
      {isConflict && <Alert color="red" role="alert">
        {selected!.label} đã có hiện vật «{occupancy.bySlot.get(selected!.id)!.name}». Hãy chọn bục khác — hệ thống không tự thay hiện vật đang ở bục này.
      </Alert>}
      {!selected && <Alert color="yellow" role="status">
        Hiện vật đang dùng tọa độ tự do (X {position.x}, Y {position.y}, Z {position.z}). Phòng chỉ hiển thị theo mẫu 5 bục khi mọi hiện vật công khai nằm trên một bục riêng.
        {!pickFreeSlot(occupancy.bySlot) && ' Cả 5 bục của phòng này đã có hiện vật.'}
      </Alert>}
      {selected && occupancy.legacyCount > 0 && <Alert color="blue" role="status">
        Phòng còn {occupancy.legacyCount} hiện vật dùng tọa độ tự do hoặc trùng bục, nên khách vẫn thấy bố cục cũ cho tới khi các hiện vật đó được chuyển lên bục.
      </Alert>}
    </Stack>
  );
}
