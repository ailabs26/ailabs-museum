import { useLayoutEffect, useMemo } from 'react';
import type { Mesh, SkinnedMesh } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { LoadedModel } from '@/helpers/roomModelAssets';
import { ARTIFACT_BASE_Y } from '@/helpers/artifactHotspots';

export function ArtifactModel({ asset, artifactId, onRetain }: {
  asset: LoadedModel; artifactId: string; onRetain?: (asset: LoadedModel) => (() => void) | undefined;
}) {
  // Clone hierarchy/bones only; the room owner keeps geometry/material ownership.
  const instance = useMemo(() => clone(asset.scene), [asset]);
  useLayoutEffect(() => onRetain?.(asset), [asset, onRetain]);
  useLayoutEffect(() => {
    instance.traverse(object => { if ((object as Mesh).isMesh) { object.castShadow = true; object.receiveShadow = true; } });
  }, [instance]);
  useLayoutEffect(() => () => instance.traverse(object => (object as SkinnedMesh).skeleton?.dispose()), [instance]);
  const { normalization } = asset;
  return <group position={[0, ARTIFACT_BASE_Y, 0]} dispose={null} userData={{ artifactId, modelLoaded: true, normalization }}>
    <group scale={normalization.scale}>
      <group position={normalization.offset}>
        <primitive object={instance} dispose={null} />
      </group>
    </group>
  </group>;
}
