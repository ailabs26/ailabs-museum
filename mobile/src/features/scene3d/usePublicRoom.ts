import { useEffect, useState } from 'react';
import { publicRoomApi } from './publicRoomApi';
import type { PublicRoomPayload } from './museumTypes';

type RoomState =
  | { status: 'loading' }
  | { status: 'ready'; room: PublicRoomPayload }
  | { status: 'error'; message: string };

export function usePublicRoom(slug: string | undefined) {
  const [state, setState] = useState<RoomState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!slug) {
      setState({ status: 'error', message: 'Thiếu mã phòng trưng bày.' });
      return;
    }
    const controller = new AbortController();
    setState({ status: 'loading' });
    publicRoomApi.detail(slug, controller.signal)
      .then((room) => { if (!controller.signal.aborted) setState({ status: 'ready', room }); })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({
          status: 'error', message: error instanceof Error ? error.message : 'Không thể tải phòng trưng bày.',
        });
      });
    return () => controller.abort();
  }, [slug, attempt]);

  return { state, retry: () => setAttempt((value) => value + 1) };
}
