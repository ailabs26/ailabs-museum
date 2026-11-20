import { useRouter } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { ArArtifactPlacementView } from '@/features/ar/ArArtifactPlacementView';
import type { MuseumDisplay } from '@/features/scene3d/museumTypes';

const DEMO_AR_EXHIBIT: MuseumDisplay = {
  id: 'demo-ar-bronze-drum',
  roomId: 'demo-room',
  title: 'Trống đồng Ngọc Lũ (AR)',
  description: 'Hiện vật văn hóa Đông Sơn chuẩn bị cho chế độ đặt trên mặt phẳng thực tế.',
  position: [0, 0, -2],
  shape: 'torus',
  color: '#B45309',
  hotspots: [
    {
      id: 'hs-sun',
      label: 'Ngôi sao mặt trời 14 cánh',
      body: 'Trung tâm mặt trống khắc họa ngôi sao nổi 14 cánh biểu trưng cho thần Mặt Trời.',
      position: [0, 0.36, 0],
    },
    {
      id: 'hs-birds',
      label: 'Vành chim Lạc bay ngược chiều kim đồng hồ',
      body: 'Họa tiết chim Lạc bay vòng tròn thể hiện khát vọng vươn lên và lịch nông nghiệp cổ.',
      position: [0.22, 0.28, 0.14],
    },
    {
      id: 'hs-handles',
      label: 'Quai trống hình bện thừng',
      body: 'Bốn đôi quai đúc liền thân trống dùng để treo và vận chuyển trong lễ hội.',
      position: [-0.24, 0.18, 0.08],
    },
  ],
};

/** Màn hình đặt hiện vật trên mặt phẳng AR + xoay/zoom (`MOB-E9-02`). */
export default function ArExhibitScreen() {
  const router = useRouter();
  return (
    <Screen edges={['bottom']}>
      <ArArtifactPlacementView
        exhibit={DEMO_AR_EXHIBIT}
        onFallback3D={() => router.replace('/room/demo-room')}
        onExit={() => router.back()}
      />
    </Screen>
  );
}
