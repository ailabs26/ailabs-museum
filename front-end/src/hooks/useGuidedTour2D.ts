import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { GuidedTourStep } from '@/interfaces/guidedTour';
import type { RoomDetail, RoomSummary } from '@/validations/roomSchema';
import { buildGuidedTourSteps } from '@/helpers/buildGuidedTourSteps';
import { guidedTour2dDetailPath, guidedTour3dPath } from '@/helpers/guidedTour2dNavigation';
import { useGuidedTour } from './useGuidedTour';

type GuidedTour2DRoute = { roomId: string | null; exhibitId: string | null };

export function useGuidedTour2D({
  room,
  publicRooms,
  route,
}: {
  room?: RoomDetail;
  publicRooms?: readonly RoomSummary[];
  route?: GuidedTour2DRoute;
}) {
  const tour = useGuidedTour();
  const { start, pause, resume: coreResume, next: coreNext, previous: corePrevious, exit: coreExit,
    reconcileRoom, invalidateRoom, steps, currentIndex, canPrevious, status } = tour;
  const navigate = useNavigate();
  const location = useLocation();
  const pendingExhibitId = useRef<string | null>(null);
  const currentStep = tour.currentStep;
  const currentRoomId = currentStep?.roomId;
  const currentExhibitId = currentStep?.exhibitId;
  const routeRoomId = route?.roomId;
  const routeExhibitId = route?.exhibitId;
  const isSameRoom = !!room && currentStep?.roomId === room.id;
  const isCurrentRoute = !!route && !!currentStep
    && route.roomId === currentStep.roomId && route.exhibitId === currentStep.exhibitId;

  useEffect(() => {
    const roomId = currentRoomId;
    if (roomId && publicRooms && !publicRooms.some((item) => item.id === roomId)) invalidateRoom(roomId);
  }, [currentRoomId, publicRooms, invalidateRoom]);

  useEffect(() => {
    if (room && isSameRoom) reconcileRoom(room);
  }, [room, isSameRoom, reconcileRoom]);

  useEffect(() => {
    if (routeRoomId === undefined || !currentRoomId || !currentExhibitId) return;
    if (routeRoomId === currentRoomId && routeExhibitId === currentExhibitId) {
      pendingExhibitId.current = null;
      return;
    }
    if (pendingExhibitId.current === currentExhibitId) return;
    pendingExhibitId.current = null;
    if (status === 'running') pause();
  }, [currentRoomId, currentExhibitId, routeRoomId, routeExhibitId, location.key, status, pause]);

  const slugFor = useCallback((step: GuidedTourStep, fallback?: RoomDetail) => (
    fallback?.id === step.roomId ? fallback.slug : publicRooms?.find((item) => item.id === step.roomId)?.slug
  ), [publicRooms]);

  const navigateToStep = useCallback((step: GuidedTourStep, fallback?: RoomDetail) => {
    if (pendingExhibitId.current === step.exhibitId) return;
    const slug = slugFor(step, fallback);
    if (!slug) return;
    if (route?.roomId === step.roomId && route.exhibitId === step.exhibitId) return;
    pendingExhibitId.current = step.exhibitId;
    navigate(guidedTour2dDetailPath(slug, step.exhibitId));
  }, [navigate, route?.exhibitId, route?.roomId, slugFor]);

  const startFromRoom = useCallback((detail: RoomDetail) => {
    const first = buildGuidedTourSteps(detail)[0];
    if (!first) return;
    pendingExhibitId.current = first.exhibitId;
    start(detail);
    navigate(guidedTour2dDetailPath(detail.slug, first.exhibitId));
  }, [navigate, start]);

  const startFromExhibit = useCallback((detail: RoomDetail, exhibitId: string) => {
    if (detail.exhibits.some((item) => item.id === exhibitId)) start(detail, exhibitId);
  }, [start]);

  const continueToCurrent = useCallback((detail?: RoomDetail) => {
    if (!currentStep) return;
    navigateToStep(currentStep, detail);
  }, [currentStep, navigateToStep]);

  const continueIn3D = useCallback((detail?: RoomDetail) => {
    if (!currentStep || status === 'idle') return;
    const slug = slugFor(currentStep, detail);
    if (!slug) return;
    pause();
    navigate(guidedTour3dPath(slug, currentStep.exhibitId));
  }, [currentStep, navigate, pause, slugFor, status]);

  const resume = useCallback(() => {
    if (!currentStep) return;
    if (!isCurrentRoute) {
      coreResume();
      navigateToStep(currentStep, room);
    }
    else coreResume();
  }, [currentStep, isCurrentRoute, room, coreResume, navigateToStep]);

  const next = useCallback(() => {
    if (pendingExhibitId.current) return;
    const nextStep = steps[currentIndex + 1];
    coreNext();
    if (nextStep) navigateToStep(nextStep, room);
  }, [navigateToStep, room, currentIndex, coreNext, steps]);

  const previous = useCallback(() => {
    if (pendingExhibitId.current || !canPrevious) return;
    const previousStep = steps[currentIndex - 1];
    if (!previousStep) return;
    corePrevious();
    navigateToStep(previousStep, room);
  }, [navigateToStep, room, canPrevious, currentIndex, corePrevious, steps]);

  const restart = useCallback((detail: RoomDetail) => startFromRoom(detail), [startFromRoom]);

  const exit = useCallback(() => {
    pendingExhibitId.current = null;
    coreExit();
  }, [coreExit]);

  return { ...tour, isSameRoom, isCurrentRoute, startFromRoom, startFromExhibit, continueToCurrent, continueIn3D, resume, next, previous, restart, exit };
}
