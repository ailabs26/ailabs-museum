import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGuidedTour } from './useGuidedTour';
import type { RoomDetail } from '@/validations/roomSchema';

export interface GuidedCameraRequest { exhibitId: string }
export interface GuidedCameraBinding {
  request: GuidedCameraRequest | null;
  hasSession: boolean;
  onResult: (request: GuidedCameraRequest, outcome: 'arrived' | 'blocked') => void;
  onManual: () => void;
  onReady: (ready: boolean) => void;
  onMoving: (request: GuidedCameraRequest) => void;
}

/** Side effects for the existing core. Request identity rejects stale camera callbacks. */
export function useGuidedCameraTour(room: RoomDetail | undefined, isOpen: boolean, onSelect: (id: string) => void) {
  const tour = useGuidedTour();
  const latest = useRef({ tour, onSelect }); latest.current = { tour, onSelect };
  const [ready, setReady] = useState(false);
  const [result, setResult] = useState<{ request: GuidedCameraRequest; outcome: 'arrived' | 'blocked' } | null>(null);
  const stepId = tour.currentStep?.roomId === room?.id ? tour.currentStep?.exhibitId : undefined;
  const running = tour.status === 'running' && isOpen && ready && !!stepId;
  const request = useMemo<GuidedCameraRequest | null>(() => running && stepId ? { exhibitId: stepId } : null, [running, stepId]);
  const requestRef = useRef(request); requestRef.current = request;
  const dwell = useRef({ stepId, remaining: 15_000 });
  if (dwell.current.stepId !== stepId) dwell.current = { stepId, remaining: 15_000 };

  useEffect(() => { if (room) latest.current.tour.reconcileRoom(room); }, [room]);
  useEffect(() => {
    if (!isOpen || !room) latest.current.tour.pause();
    if (room && latest.current.tour.currentStep && latest.current.tour.currentStep.roomId !== room.id) latest.current.tour.exit();
  }, [isOpen, room]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) latest.current.tour.pause(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { document.removeEventListener('visibilitychange', hidden); latest.current.tour.pause(); };
  }, []);

  const onResult = useCallback((completed: GuidedCameraRequest, outcome: 'arrived' | 'blocked') => {
    if (requestRef.current !== completed) return;
    setResult(previous => previous?.request === completed ? previous : { request: completed, outcome });
    latest.current.onSelect(completed.exhibitId);
  }, []);
  const onManual = useCallback(() => latest.current.tour.pause(), []);
  const onMoving = useCallback((moving: GuidedCameraRequest) => {
    if (requestRef.current === moving) setResult(null);
  }, []);
  const onReady = useCallback((value: boolean) => {
    setReady(value);
    if (!value) latest.current.tour.pause();
  }, []);

  useEffect(() => {
    if (!running || !request || result?.request !== request || result.outcome !== 'arrived') return;
    const current = dwell.current;
    const deadline = performance.now() + current.remaining;
    const timer = window.setTimeout(() => {
      if (requestRef.current !== request || latest.current.tour.status !== 'running') return;
      current.remaining = 15_000;
      latest.current.tour.next();
    }, current.remaining);
    return () => {
      window.clearTimeout(timer);
      current.remaining = Math.max(0, deadline - performance.now());
    };
  }, [running, request, result]);

  const phase: 'completed' | 'paused' | 'viewing' | 'blocked' | 'moving' | 'idle' = tour.status === 'completed' ? 'completed' : tour.status === 'paused' ? 'paused'
    : result?.request === request && result ? result.outcome === 'arrived' ? 'viewing' : 'blocked'
      : running ? 'moving' : 'idle';
  const camera: GuidedCameraBinding = { request, hasSession: tour.status !== 'idle', onResult, onManual, onReady, onMoving };
  return { tour, camera, phase, ready, canStart: !!room?.exhibits.length, start: () => { if (room && ready && isOpen) tour.start(room); } };
}
