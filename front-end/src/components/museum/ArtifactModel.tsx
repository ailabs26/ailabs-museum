import { useLayoutEffect, useMemo } from 'react';
import type { SkinnedMesh } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { LoadedModel } from '@/helpers/roomModelAssets';

export function ArtifactModel({ asset, artifactId }: { asset: LoadedModel; artifactId: string }) {
  // Clone hierarchy/bones only; the room owner keeps geometry/material ownership.
  const instance = useMemo(() => clone(asset.scene), [asset]);
  useLayoutEffect(() => () => instance.traverse(object => (object as SkinnedMesh).skeleton?.dispose()), [instance]);
  const { normalization } = asset;
  return <group position={[0, 1.14, 0]} dispose={null} userData={{ artifactId, modelLoaded: true, normalization }}>
    <group scale={normalization.scale}>
      <group position={normalization.offset}>
        <primitive object={instance} dispose={null} />
      </group>
    </group>
  </group>;
}
