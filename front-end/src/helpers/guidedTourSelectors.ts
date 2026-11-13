import type { GuidedTourState } from '@/interfaces/guidedTour';

export function selectGuidedTour(state: GuidedTourState) {
  const { session, status } = state;
  const steps = session?.steps ?? [];
  const total = steps.length;
  const currentIndex = session?.currentIndex ?? -1;

  return {
    status,
    steps,
    currentStep: session ? steps[currentIndex] : null,
    currentIndex,
    total,
    progress: status === 'completed' ? 1 : total ? (currentIndex + 1) / total : 0,
    canNext: status === 'running' || status === 'paused',
    canPrevious: !!session && currentIndex > 0,
  };
}
