import { useRouter } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { ArSpikeView } from '@/features/ar/ArSpikeView';

/** Màn hình kiểm thử Spike AR iOS ARKit + Android ARCore (`MOB-E9-01`). */
export default function SpikeArScreen() {
  const router = useRouter();
  return (
    <Screen edges={['bottom']}>
      <ArSpikeView
        onFallback3D={() => router.replace('/room/demo-room')}
        onExit={() => router.back()}
      />
    </Screen>
  );
}
