import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { GlbArtifactView } from '@/features/scene3d/GlbArtifactView';
import type { PublicModel } from '@/features/scene3d/glbSchema';

/**
 * Màn kiểm thử tải 1 hiện vật GLB có cache cục bộ (MOB-E6-02).
 * Nhận tham số `slug`, `exhibitId`, `checksum`, `sizeBytes`, `title` hoặc dùng bản mẫu API local.
 */
export default function GlbPreviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    slug?: string;
    exhibitId?: string;
    checksum?: string;
    sizeBytes?: string;
    title?: string;
  }>();

  const slug = params.slug ?? 'demo-room';
  const exhibitId = params.exhibitId ?? '10000000-0000-4000-8000-000000000001';
  const checksum = params.checksum ?? '4527093ab595d03c'.padEnd(64, '0');
  const parsedSize = Number(params.sizeBytes);
  const sizeBytes = Number.isInteger(parsedSize) && parsedSize > 0 ? parsedSize : 320;

  const model: PublicModel = {
    id: exhibitId,
    storageKey: `models/${exhibitId}.glb`,
    sizeBytes,
    checksumSha256: checksum,
    url: `/rooms/${slug}/exhibits/${exhibitId}/model?version=${checksum}`,
  };

  return (
    <Screen edges={['bottom']}>
      <GlbArtifactView
        title={params.title ?? 'Kiểm thử hiện vật GLB (MOB-E6-02)'}
        model={model}
        onFallback2D={() => router.back()}
      />
    </Screen>
  );
}
