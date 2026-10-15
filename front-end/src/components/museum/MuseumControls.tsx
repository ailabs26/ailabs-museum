import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PerspectiveCamera, Spherical, Vector3 } from 'three';
import type { ModelFocusBounds } from '@/helpers/museumCamera';
import { useReducedMotion } from '@mantine/hooks';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import { CAMERA_MAX_POLAR, CAMERA_MIN_POLAR, constrainCameraToRoom, getExhibitView, getOrbitLimit, INITIAL_CAMERA_POSITION, INITIAL_CAMERA_TARGET } from '@/helpers/museumCamera';

export type CameraAction = 'left' | 'right' | 'up' | 'down' | 'in' | 'out' | 'reset' | 'focus';
export interface CameraCommand { action: CameraAction; sequence: number }
const KEY_ACTIONS: Record<string, CameraAction> = {
  ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
  ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down',
  '+': 'in', '=': 'in', '-': 'out', Home: 'reset', f: 'focus', F: 'focus',
};
interface FocusTransition {
  fromPosition: Vector3; fromTarget: Vector3; toPosition: Vector3; toTarget: Vector3; startedAt: number;
  isModel: boolean;
}

export function MuseumControls({ command, selectedDisplay, focusBounds }: { command: CameraCommand | null; selectedDisplay?: MuseumDisplay; focusBounds?: ModelFocusBounds }) {
  const { camera, gl, invalidate, size } = useThree();
  const prefersReducedMotion = useReducedMotion();
  const motionRef = useRef(prefersReducedMotion);
  const selectedRef = useRef(selectedDisplay);
  const boundsRef = useRef(focusBounds);
  const autoFocusRef = useRef({ id: selectedDisplay?.id, allowed: true });
  const aspectRef = useRef(size.width / size.height);
  aspectRef.current = size.width / size.height;
  const transitionRef = useRef<FocusTransition | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const actionRef = useRef<((action: CameraAction) => void) | null>(null);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.target.fromArray(INITIAL_CAMERA_TARGET);
    controls.minDistance = 3.5;
    controls.maxDistance = getOrbitLimit(INITIAL_CAMERA_TARGET);
    controls.minPolarAngle = CAMERA_MIN_POLAR;
    controls.maxPolarAngle = CAMERA_MAX_POLAR;
    controls.enablePan = false;
    controls.enableDamping = !motionRef.current;
    controls.dampingFactor = 0.12;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.65;
    const lastSafePosition = camera.position.clone();
    const handleChange = () => {
      constrainCameraToRoom(camera.position, lastSafePosition);
      camera.lookAt(controls.target);
      invalidate();
    };
    const handleStart = () => {
      transitionRef.current = null;
      autoFocusRef.current.allowed = false;
      controls.enableDamping = !motionRef.current;
    };
    controls.addEventListener('change', handleChange);
    controls.addEventListener('start', handleStart);
    controls.update();
    controlsRef.current = controls;
    const canvas = gl.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Phòng trưng bày 3D');
    canvas.setAttribute('aria-describedby', 'museum-controls-help');
    canvas.focus({ preventScroll: true });

    const handleAction = (action: CameraAction) => {
      transitionRef.current = null;
      autoFocusRef.current.allowed = action === 'focus';
      // Flush inertia before precise keyboard/reset/focus endpoints.
      controls.enableDamping = false;
      controls.update();
      if (action === 'focus') {
        const view = selectedRef.current && getExhibitView(selectedRef.current, boundsRef.current, aspectRef.current,
          camera instanceof PerspectiveCamera ? camera.fov : 60);
        if (!view) { controls.enableDamping = !motionRef.current; return; }
        controls.minDistance = boundsRef.current ? Math.max(0.5, boundsRef.current.radius * 1.2) : 2.2;
        controls.maxDistance = boundsRef.current ? 12 : getOrbitLimit(view.target);
        if (motionRef.current) {
          controls.target.fromArray(view.target);
          camera.position.fromArray(view.position);
        } else {
          transitionRef.current = {
            fromPosition: camera.position.clone(), fromTarget: controls.target.clone(),
            toPosition: new Vector3(...view.position), toTarget: new Vector3(...view.target), startedAt: performance.now(),
            isModel: !!boundsRef.current,
          };
          invalidate();
          return;
        }
      } else if (action === 'reset') {
        controls.target.fromArray(INITIAL_CAMERA_TARGET);
        controls.minDistance = 3.5;
        controls.maxDistance = getOrbitLimit(INITIAL_CAMERA_TARGET);
        camera.position.fromArray(INITIAL_CAMERA_POSITION);
      } else {
        const offset = camera.position.clone().sub(controls.target);
        const orbit = new Spherical().setFromVector3(offset);
        if (action === 'left') orbit.theta -= 0.12;
        if (action === 'right') orbit.theta += 0.12;
        if (action === 'up') orbit.phi -= 0.06;
        if (action === 'down') orbit.phi += 0.06;
        if (action === 'in') orbit.radius *= 0.88;
        if (action === 'out') orbit.radius /= 0.88;
        camera.position.copy(offset.setFromSpherical(orbit).add(controls.target));
      }
      controls.update();
      controls.enableDamping = !motionRef.current;
      invalidate();
    };
    actionRef.current = handleAction;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const action = KEY_ACTIONS[event.key];
      if (!action) return;
      event.preventDefault();
      handleAction(action);
    };
    const handlePointerDown = () => { handleStart(); canvas.focus({ preventScroll: true }); };
    canvas.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('wheel', handleStart, { passive: true });
    return () => {
      transitionRef.current = null;
      canvas.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('wheel', handleStart);
      controls.removeEventListener('change', handleChange);
      controls.removeEventListener('start', handleStart);
      controls.dispose();
      controlsRef.current = null;
      actionRef.current = null;
    };
  }, [camera, gl, invalidate]);

  useEffect(() => {
    motionRef.current = prefersReducedMotion;
    const controls = controlsRef.current;
    if (!controls) return;
    const transition = transitionRef.current;
    if (prefersReducedMotion && transition) {
      camera.position.copy(transition.toPosition);
      controls.target.copy(transition.toTarget);
      controls.maxDistance = transition.isModel ? 12 : getOrbitLimit(controls.target.toArray());
      transitionRef.current = null;
      controls.update();
      invalidate();
    }
    controls.enableDamping = !prefersReducedMotion && !transitionRef.current;
  }, [prefersReducedMotion, camera, invalidate]);

  useEffect(() => {
    selectedRef.current = selectedDisplay;
    boundsRef.current = focusBounds;
    if (autoFocusRef.current.id !== selectedDisplay?.id) autoFocusRef.current = { id: selectedDisplay?.id, allowed: true };
    if (selectedDisplay && autoFocusRef.current.allowed) actionRef.current?.('focus');
    else {
      transitionRef.current = null;
      if (controlsRef.current) controlsRef.current.enableDamping = !motionRef.current;
    }
  }, [selectedDisplay, focusBounds, size.width, size.height]);
  useEffect(() => { if (command) actionRef.current?.(command.action); }, [command]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const transition = transitionRef.current;
    if (transition) {
      const progress = Math.min(1, (performance.now() - transition.startedAt) / 550);
      const eased = progress * progress * (3 - 2 * progress);
      camera.position.lerpVectors(transition.fromPosition, transition.toPosition, eased);
      controls.target.lerpVectors(transition.fromTarget, transition.toTarget, eased);
      controls.maxDistance = transition.isModel ? 12 : getOrbitLimit(controls.target.toArray());
      controls.update();
      if (progress < 1) invalidate();
      else { transitionRef.current = null; controls.enableDamping = !motionRef.current; }
    } else controls.update();
  });
  return null;
}
