export type GuidedTourStatus = 'idle' | 'running' | 'paused' | 'completed';

export type GuidedTourStep = Readonly<{
  roomId: string;
  exhibitId: string;
}>;

export type GuidedTourSession = Readonly<{
  roomId: string;
  roomSlug: string;
  steps: readonly GuidedTourStep[];
  currentIndex: number;
}>;

/** Idle has no session; every active state has unique same-room steps and a valid index. */
export type GuidedTourState = Readonly<{
  status: GuidedTourStatus;
  session: GuidedTourSession | null;
}>;

export const INITIAL_GUIDED_TOUR_STATE: GuidedTourState = {
  status: 'idle',
  session: null,
};
