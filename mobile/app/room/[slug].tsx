import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { GalleryRoomView } from '@/features/scene3d/GalleryRoomView';
import { GALLERY_SLOTS } from '@/features/scene3d/gallerySlots';
import type { MuseumDisplay } from '@/features/scene3d/museumTypes';

const DEMO_SLOTTED_EXHIBITS: readonly MuseumDisplay[] = [
  {
    id: 'demo-s01',
    roomId: 'demo-room',
    title: 'Trống đồng Ngọc Lũ',
    description: 'Hiện vật trung tâm đặt tại Bục 01 (S01) — biểu tượng văn hóa Đông Sơn.',
    position: [...GALLERY_SLOTS[0]!.position],
    shape: 'torus',
    color: '#B45309',
  },
  {
    id: 'demo-s02',
    roomId: 'demo-room',
    title: 'Bình gốm Chu Đậu',
    description: 'Gốm hoa lam thế kỷ XV đặt tại Bục 02 – Trái sau (S02).',
    position: [...GALLERY_SLOTS[1]!.position],
    shape: 'cylinder',
    color: '#0F766E',
  },
  {
    id: 'demo-s03',
    roomId: 'demo-room',
    title: 'Ấn vàng Hoàng đế',
    description: 'Hiện vật triều Nguyễn đặt tại Bục 03 – Phải sau (S03).',
    position: [...GALLERY_SLOTS[2]!.position],
    shape: 'cube',
    color: '#D97706',
  },
  {
    id: 'demo-s04',
    roomId: 'demo-room',
    title: 'Tượng đá Champa',
    description: 'Điêu khắc sa thạch cổ đặt tại Bục 04 – Trái trước (S04).',
    position: [...GALLERY_SLOTS[3]!.position],
    shape: 'cone',
    color: '#64748B',
  },
  {
    id: 'demo-s05',
    roomId: 'demo-room',
    title: 'Đĩa men ngọc thời Lý',
    description: 'Gốm men ngọc thế kỷ XI đặt tại Bục 05 – Phải trước (S05).',
    position: [...GALLERY_SLOTS[4]!.position],
    shape: 'sphere',
    color: '#0D9488',
  },
];

/**
 * Màn chi tiết phòng 3D trên nested stack (`/room/:slug`) — MOB-E6-04.
 * Render đủ 5 bục Gallery Template V1 và song song danh sách 2D dễ tiếp cận.
 */
export default function RoomDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const roomName = slug ? `Phòng trưng bày: ${slug}` : 'Phòng trưng bày 3D';

  return (
    <Screen edges={['bottom']}>
      <GalleryRoomView roomName={roomName} displays={DEMO_SLOTTED_EXHIBITS} />
    </Screen>
  );
}
