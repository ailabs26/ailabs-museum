import { useCallback, useEffect, useRef, useState } from 'react';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import type { PublicModel } from '@/validations/roomSchema';
import { RoomModelLods } from '@/helpers/roomModelLods';
import type { LodSnapshot } from '@/helpers/roomModelLods';
import type { LoadedModel } from '@/helpers/roomModelAssets';
import { modelLodSetSchema } from '@/helpers/modelLod';
import type { ModelLodLevel, ModelLodSet } from '@/helpers/modelLod';
import { loadMuseumModel } from '@/helpers/loadMuseumModel';
import { reportModelFailure } from '@/helpers/modelDiagnostics';

export function useRoomModels(displays: readonly MuseumDisplay[], lodSets: readonly ModelLodSet[] = []) {
  const signature = JSON.stringify({ models: displays.flatMap(display => display.model && !display.isOutsideRoom ? [display.model] : []),
    consumers: displays.flatMap(display => display.model && !display.isOutsideRoom ? [display.id] : []), lodSets });
  const ownerRef = useRef<RoomModelLods | null>(null);
  const displaysRef = useRef(displays); displaysRef.current = displays;
  const [state, setState] = useState<{ signature: string; models: LodSnapshot }>({ signature: '', models: {} });
  useEffect(() => {
    const input = JSON.parse(signature) as { models: PublicModel[]; lodSets: unknown[] };
    const sets = input.lodSets.map(value => modelLodSetSchema.parse(value));
    const owner = new RoomModelLods(loadMuseumModel, models => setState({ signature, models }), (key, failure, attempt) => {
      for (const display of displaysRef.current.filter(display => display.model?.checksumSha256 === key)) {
        reportModelFailure({ artifactId: display.id, roomId: display.roomId, ...failure, attempt });
      }
    }, sets);
    ownerRef.current = owner;
    owner.start(input.models);
    return () => { ownerRef.current = null; owner.dispose(); };
  }, [signature]);
  // Sweep inactive candidates. Pool references protect primitives across R3F's separate commits.
  useEffect(() => { if (state.signature === signature) ownerRef.current?.sweep(); }, [state, signature]);
  const retainModel = useCallback((asset: LoadedModel) => ownerRef.current?.retain(asset), []);
  return { models: state.signature === signature ? state.models : {}, retry: (checksum: string) => ownerRef.current?.retry(checksum),
    selectLod: (checksum: string, level: ModelLodLevel, consumerId?: string) => ownerRef.current?.select(checksum, level, consumerId), retainModel };
}
