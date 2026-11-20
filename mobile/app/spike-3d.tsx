import { useRouter } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { ThreeSpikeView } from '@/features/scene3d/ThreeSpikeView';

/**
 * Màn hình kiểm thử Spike 3D (`MOB-E6-01`): R3F Native + Expo GL render 1 cube 60 FPS.
 */
export default function Spike3DScreen() {
  const router = useRouter();
  return (
    <Screen edges={['bottom']}>
      <ThreeSpikeView onFallback2D={() => router.back()} />
    </Screen>
  );
}
