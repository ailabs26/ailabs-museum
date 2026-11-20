import { useEffect, useMemo, useReducer } from 'react';
import type { ModelNormalization } from '@/features/scene3d/glbValidation';
import {
  ArArtifactPlacementView,
  type ArArtifactPlacementViewProps,
} from './ArArtifactPlacementView';
import { arHotspotStoryReducer, resolveArHotspots } from './arHotspots';
import { ArHotspotHudOverlay, ArHotspotSceneMarkers } from './ArHotspotOverlay';

export interface ArExhibitExperienceViewProps
  extends Omit<ArArtifactPlacementViewProps, 'renderPlacedSceneChildren' | 'renderPlacedOverlay'> {
  normalization?: ModelNormalization;
}

/**
 * Trải nghiệm AR hoàn chỉnh kết hợp đặt mặt phẳng + xoay/zoom (`MOB-E9-02`)
 * và lớp phủ điểm thuyết minh hotspot tương tác (`MOB-E9-03`).
 */
export function ArExhibitExperienceView({
  exhibit,
  normalization,
  ...rest
}: ArExhibitExperienceViewProps) {
  const hotspots = useMemo(
    () => resolveArHotspots(exhibit, normalization),
    [exhibit, normalization],
  );

  const [storyState, dispatchStory] = useReducer(arHotspotStoryReducer, { selectedId: null });

  useEffect(() => {
    dispatchStory({ type: 'RECONCILE', hotspots });
  }, [hotspots]);

  return (
    <ArArtifactPlacementView
      {...rest}
      exhibit={exhibit}
      renderPlacedSceneChildren={({ viro, placement }) => (
        <ArHotspotSceneMarkers
          viro={viro}
          hotspots={hotspots}
          selectedHotspotId={storyState.selectedId}
          arScale={placement.scale}
          onSelectHotspot={(hotspotId) => dispatchStory({ type: 'TOGGLE', hotspotId })}
        />
      )}
      renderPlacedOverlay={() => (
        <ArHotspotHudOverlay
          hotspots={hotspots}
          selectedHotspotId={storyState.selectedId}
          onSelect={(hotspotId) => dispatchStory({ type: 'SELECT', hotspotId })}
          onPrev={() => dispatchStory({ type: 'PREV', hotspots })}
          onNext={() => dispatchStory({ type: 'NEXT', hotspots })}
          onClose={() => dispatchStory({ type: 'CLOSE' })}
        />
      )}
    />
  );
}
