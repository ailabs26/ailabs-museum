import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, PerspectiveCamera, Vector3 } from 'three';
import { useReducedMotion } from '@mantine/hooks';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import { MUSEUM_ROOM_SIZE } from '@/interfaces/museumScene';
import { getExhibitView, getMuseumFov, INITIAL_CAMERA_POSITION, INITIAL_CAMERA_TARGET, type ModelFocusBounds } from '@/helpers/museumCamera';
import { applyLook, findNavigationPath, findSafeNavigationPoint, getDisplayColliders, isNavigationPositionSafe, moveWithCollisions, NAVIGATION, stepMovement, type NavigationInput, type NavigationVector } from '@/helpers/museumNavigation';
import { attachNavigationInput, type NavigationAction } from '@/helpers/attachNavigationInput';
import type { NavigationGestures } from '@/helpers/navigationGestures';
import type { NavigationMode } from './NavigationHud';
import { cinematicPosition, getCinematicEntrance, type Vec3 } from '@/helpers/cinematicIntro';

export type CameraAction = NavigationAction;
export interface CameraCommand { action: CameraAction; sequence: number }
interface FocusTransition {
  fromPosition: Vector3; fromTarget: Vector3; toPosition: Vector3; toTarget: Vector3; startedAt: number;
  path: NavigationVector[]; lengths: number[]; totalLength: number;
}

/** Sole transform owner: exploration and focus share one demand-frame pipeline. */
export function MuseumControls({ enabled = true, command, selectedDisplay, focusBounds, displays, input, gestures, onModeChange, onActiveChange }: {
  enabled?: boolean;
  command: CameraCommand | null; selectedDisplay?: MuseumDisplay; focusBounds?: ModelFocusBounds;
  displays: readonly MuseumDisplay[]; input: NavigationInput; gestures: NavigationGestures;
  onModeChange: (mode: NavigationMode) => void; onActiveChange: (isActive: boolean) => void;
}) {
  const { camera, gl, invalidate, size } = useThree();
  const prefersReducedMotion = useReducedMotion(false, { getInitialValueInEffect: false });
  const reducedRef = useRef(prefersReducedMotion); reducedRef.current = prefersReducedMotion;
  const colliders = useMemo(() => getDisplayColliders(displays), [displays]);
  const collidersRef = useRef(colliders); collidersRef.current = colliders;
  const selectedRef = useRef(selectedDisplay); selectedRef.current = selectedDisplay;
  const boundsRef = useRef(focusBounds); boundsRef.current = focusBounds;
  const aspectRef = useRef(1); aspectRef.current = size.width / size.height;
  const autoFocusRef = useRef({ id: selectedDisplay?.id, allowed: true });
  const transitionRef = useRef<FocusTransition | null>(null);
  const introAttemptedRef = useRef(false);
  const introRef = useRef<{ from: Vec3; to: Vec3; startedAt: number } | null>(null);
  const actionRef = useRef<((action: CameraAction) => void) | null>(null);
  const modeRef = useRef<NavigationMode>('explore');
  const runtime = useMemo(() => ({
    velocity: new Vector3(), euler: new Euler(0, 0, 0, 'YXZ'),
    look: { yaw: 0, pitch: 0 }, goal: { yaw: 0, pitch: 0 }, movement: { x: 0, y: 0 },
    desired: new Vector3(), target: new Vector3(), direction: new Vector3(), isWalking: false,
  }), []);
  const callbacks = useRef({ onModeChange, onActiveChange }); callbacks.current = { onModeChange, onActiveChange };

  useLayoutEffect(() => {
    if (!enabled || !(camera instanceof PerspectiveCamera)) return;
    camera.fov = getMuseumFov(size.width / size.height);
    camera.updateProjectionMatrix(); invalidate();
  }, [enabled, camera, size.width, size.height, invalidate]);

  useEffect(() => {
    if (!enabled) {
      input.stop(); transitionRef.current = null; introRef.current = null; autoFocusRef.current = { id: selectedRef.current?.id, allowed: false };
      runtime.velocity.set(0, 0, 0); return;
    }
    const setMode = (mode: NavigationMode) => { modeRef.current = mode; callbacks.current.onModeChange(mode); };
    const syncLook = () => {
      runtime.euler.setFromQuaternion(camera.quaternion, 'YXZ');
      runtime.look.yaw = runtime.goal.yaw = runtime.euler.y;
      runtime.look.pitch = runtime.goal.pitch = runtime.euler.x;
    };
    const stop = () => {
      input.keys.clear(); input.joystick.x = input.joystick.y = input.look.x = input.look.y = 0;
      runtime.velocity.set(0, 0, 0); runtime.isWalking = false; syncLook();
    };
    const explore = () => {
      if (introRef.current) { introRef.current = null; syncLook(); }
      transitionRef.current = null; autoFocusRef.current.allowed = false;
      if (modeRef.current !== 'explore') { syncLook(); setMode('explore'); }
    };
    input.stop = stop; input.invalidate = invalidate;
    input.wake = () => { explore(); callbacks.current.onActiveChange(true); invalidate(); };
    syncLook();
    const action = (action: CameraAction) => {
      introRef.current = null;
      stop(); transitionRef.current = null; autoFocusRef.current.allowed = action === 'focus';
      if (action === 'focus') {
        const view = selectedRef.current && getExhibitView(selectedRef.current, boundsRef.current, aspectRef.current,
          camera instanceof PerspectiveCamera ? camera.fov : 60);
        if (!view) return;
        const destination = new Vector3(...view.position), target = new Vector3(...view.target);
        // A neighbouring exhibit can occupy the nominal focus point.
        if (!isNavigationPositionSafe(destination.x, destination.z, MUSEUM_ROOM_SIZE, collidersRef.current)) {
          const distance = Math.max(1.8, Math.hypot(destination.x - target.x, destination.z - target.z));
          let found = false;
          for (let ring = 0; ring < 3 && !found; ring++) for (let i = 0; i < 24; i++) {
            const angle = i * Math.PI / 12, radius = distance + ring * 0.6;
            const x = target.x + Math.sin(angle) * radius, z = target.z + Math.cos(angle) * radius;
            if (isNavigationPositionSafe(x, z, MUSEUM_ROOM_SIZE, collidersRef.current)) { destination.x = x; destination.z = z; found = true; break; }
          }
          if (!found) { setMode('explore'); return; }
        }
        const path = findNavigationPath({ x: camera.position.x, y: camera.position.z }, { x: destination.x, y: destination.z }, MUSEUM_ROOM_SIZE, collidersRef.current);
        if (!path) { setMode('explore'); return; }
        // Reduced-motion focus is synchronous, as in the previous controller.
        // Closing details immediately must not cancel a not-yet-rendered jump.
        if (reducedRef.current) {
          camera.position.copy(destination); camera.lookAt(target); syncLook();
          setMode('inspect'); invalidate(); return;
        }
        const lengths = [0];
        for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
        camera.getWorldDirection(runtime.direction);
        transitionRef.current = {
          fromPosition: camera.position.clone(), fromTarget: camera.position.clone().addScaledVector(runtime.direction, camera.position.distanceTo(target)),
          toPosition: destination, toTarget: target, startedAt: performance.now(),
          path, lengths, totalLength: lengths.at(-1)!,
        };
        setMode('focusing');
      } else if (action === 'reset') {
        const safe = findSafeNavigationPoint({ x: INITIAL_CAMERA_POSITION[0], y: INITIAL_CAMERA_POSITION[2] }, MUSEUM_ROOM_SIZE, collidersRef.current);
        if (safe) { camera.position.x = safe.x; camera.position.z = safe.y; }
        camera.position.y = INITIAL_CAMERA_POSITION[1]; camera.lookAt(...INITIAL_CAMERA_TARGET);
        setMode('explore'); syncLook();
      } else {
        explore();
        if (action === 'in' || action === 'out') {
          const step = action === 'in' ? 0.55 : -0.55;
          moveWithCollisions(camera.position, -Math.sin(runtime.look.yaw) * step, -Math.cos(runtime.look.yaw) * step, MUSEUM_ROOM_SIZE, collidersRef.current);
        } else {
          applyLook(runtime.goal, action === 'left' ? -40 : action === 'right' ? 40 : 0, action === 'up' ? -20 : action === 'down' ? 20 : 0, NAVIGATION.mouseSensitivity);
          // Discrete accessible commands finish in this action. Only continuous
          // mouse/touch look needs inertia and further demand frames.
          runtime.look.yaw = runtime.goal.yaw; runtime.look.pitch = runtime.goal.pitch;
          runtime.euler.set(runtime.look.pitch, runtime.look.yaw, 0, 'YXZ'); camera.quaternion.setFromEuler(runtime.euler);
        }
      }
      invalidate();
    };
    actionRef.current = action;
    const detach = attachNavigationInput(gl.domElement, input, gestures, action, active => callbacks.current.onActiveChange(active));
    return () => {
      detach(); transitionRef.current = null; actionRef.current = null;
      input.wake = input.invalidate = input.stop = () => {};
    };
  }, [enabled, camera, gl, invalidate, input, gestures, runtime]);

  useEffect(() => {
    if (introAttemptedRef.current || !enabled) return;
    introAttemptedRef.current = true;
    const entrance = !prefersReducedMotion && !selectedDisplay && getCinematicEntrance(displays);
    if (!entrance) return;
    introRef.current = { ...entrance, startedAt: performance.now() };
    camera.position.set(...entrance.from); camera.lookAt(...INITIAL_CAMERA_TARGET); invalidate();
  }, [enabled, prefersReducedMotion, selectedDisplay, displays, camera, invalidate]);

  useEffect(() => {
    if (!enabled) return;
    // New published placement can occupy a previous camera position. Recover to
    // the nearest free proxy boundary, never remain trapped inside new geometry.
    const safe = findSafeNavigationPoint({ x: camera.position.x, y: camera.position.z }, MUSEUM_ROOM_SIZE, colliders);
    if (safe && (safe.x !== camera.position.x || safe.y !== camera.position.z)) {
      transitionRef.current = null; introRef.current = null; camera.position.x = safe.x; camera.position.z = safe.y; invalidate();
    }
  }, [enabled, camera, colliders, invalidate]);

  useEffect(() => {
    if (!enabled) { autoFocusRef.current = { id: selectedDisplay?.id, allowed: false }; return; }
    if (autoFocusRef.current.id !== selectedDisplay?.id) autoFocusRef.current = { id: selectedDisplay?.id, allowed: true };
    if (selectedDisplay && autoFocusRef.current.allowed) actionRef.current?.('focus');
    else if (!selectedDisplay) {
      transitionRef.current = null;
      runtime.euler.setFromQuaternion(camera.quaternion, 'YXZ');
      runtime.look.yaw = runtime.goal.yaw = runtime.euler.y; runtime.look.pitch = runtime.goal.pitch = runtime.euler.x;
      modeRef.current = 'explore'; callbacks.current.onModeChange('explore');
    }
  }, [enabled, selectedDisplay, focusBounds, size.width, size.height, camera, runtime]);
  useEffect(() => { if (command) actionRef.current?.(command.action); }, [command]);

  useFrame((_, rawDelta) => {
    if (!enabled) return;
    const intro = introRef.current;
    if (intro && !prefersReducedMotion) {
      const next = cinematicPosition(intro.from, intro.to, performance.now() - intro.startedAt);
      camera.position.set(...next.position); camera.lookAt(...INITIAL_CAMERA_TARGET);
      runtime.euler.setFromQuaternion(camera.quaternion, 'YXZ');
      runtime.look.yaw = runtime.goal.yaw = runtime.euler.y; runtime.look.pitch = runtime.goal.pitch = runtime.euler.x;
      if (next.done) introRef.current = null; else invalidate();
      return;
    }
    if (prefersReducedMotion) introRef.current = null;
    const transition = transitionRef.current;
    if (transition) {
      const progress = reducedRef.current ? 1 : Math.min(1, (performance.now() - transition.startedAt) / 550);
      const eased = progress * progress * (3 - 2 * progress);
      runtime.desired.lerpVectors(transition.fromPosition, transition.toPosition, eased);
      const distance = transition.totalLength * eased;
      let segment = 1;
      while (segment < transition.path.length - 1 && transition.lengths[segment] < distance) segment++;
      const from = transition.path[segment - 1], to = transition.path[segment];
      const fraction = Math.min(1, (distance - transition.lengths[segment - 1]) / (transition.lengths[segment] - transition.lengths[segment - 1] || 1));
      camera.position.set(from.x + (to.x - from.x) * fraction, runtime.desired.y, from.y + (to.y - from.y) * fraction);
      runtime.target.lerpVectors(transition.fromTarget, transition.toTarget, eased); camera.lookAt(runtime.target);
      if (progress < 1) invalidate();
      else {
        transitionRef.current = null; modeRef.current = 'inspect'; callbacks.current.onModeChange('inspect');
        runtime.euler.setFromQuaternion(camera.quaternion, 'YXZ');
        runtime.look.yaw = runtime.goal.yaw = runtime.euler.y; runtime.look.pitch = runtime.goal.pitch = runtime.euler.x;
      }
      return;
    }
    const delta = Math.min(NAVIGATION.maxDelta, rawDelta);
    const keys = input.keys;
    runtime.movement.x = Number(keys.has('KeyD')) - Number(keys.has('KeyA')) + input.joystick.x;
    runtime.movement.y = Number(keys.has('KeyW')) - Number(keys.has('KeyS')) + input.joystick.y;
    applyLook(runtime.goal, input.look.x, input.look.y, 1); input.look.x = input.look.y = 0;
    const hasLook = Math.abs(runtime.goal.yaw - runtime.look.yaw) + Math.abs(runtime.goal.pitch - runtime.look.pitch) > 0.00001;
    if (hasLook) {
      const blend = reducedRef.current ? 1 : 1 - Math.exp(-24 * delta);
      runtime.look.yaw += (runtime.goal.yaw - runtime.look.yaw) * blend;
      runtime.look.pitch += (runtime.goal.pitch - runtime.look.pitch) * blend;
      runtime.euler.set(runtime.look.pitch, runtime.look.yaw, 0, 'YXZ'); camera.quaternion.setFromEuler(runtime.euler);
    }
    const hasMovement = stepMovement(camera.position, runtime.velocity, runtime.movement, runtime.look.yaw,
      keys.has('ShiftLeft') || keys.has('ShiftRight'), delta, MUSEUM_ROOM_SIZE, collidersRef.current);
    if (runtime.movement.x || runtime.movement.y) runtime.isWalking = true;
    const hasHeight = runtime.isWalking && Math.abs(camera.position.y - NAVIGATION.eyeHeight) > 0.0001;
    if (hasHeight) camera.position.y += (NAVIGATION.eyeHeight - camera.position.y) * (1 - Math.exp(-12 * delta));
    if (hasLook || hasMovement || hasHeight) invalidate();
  });
  return null;
}
