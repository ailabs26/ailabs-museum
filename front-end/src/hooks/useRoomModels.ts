import { useEffect, useRef, useState } from 'react';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import type { PublicModel } from '@/validations/roomSchema';
import { RoomModelAssets } from '@/helpers/roomModelAssets';
import type { ModelSnapshot } from '@/helpers/roomModelAssets';
import { loadMuseumModel } from '@/helpers/loadMuseumModel';

export function useRoomModels(displays: readonly MuseumDisplay[]) {
  const signature = JSON.stringify(displays.flatMap(display => display.model && !display.isOutsideRoom ? [display.model] : []));
  const ownerRef = useRef<RoomModelAssets | null>(null);
  const [state, setState] = useState<{ signature: string; models: ModelSnapshot }>({ signature: '', models: {} });
  useEffect(() => {
    const owner = new RoomModelAssets(loadMuseumModel, models => setState({ signature, models }));
    ownerRef.current = owner;
    owner.start(JSON.parse(signature) as PublicModel[]);
    return () => { ownerRef.current = null; owner.dispose(); };
  }, [signature]);
  return { models: state.signature === signature ? state.models : {}, retry: (checksum: string) => ownerRef.current?.retry(checksum) };
}
