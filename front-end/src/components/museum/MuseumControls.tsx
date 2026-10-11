import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Spherical } from 'three';
import { useReducedMotion } from '@mantine/hooks';

export type CameraAction = 'left' | 'right' | 'up' | 'down' | 'in' | 'out' | 'reset';
export interface CameraCommand { action: CameraAction; sequence: number }
const KEY_ACTIONS: Record<string, CameraAction> = {
  ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
  ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down',
  '+': 'in', '=': 'in', '-': 'out', Home: 'reset',
};

export function MuseumControls({ command }: { command: CameraCommand | null }) {
  const { camera, gl, invalidate } = useThree();
  const prefersReducedMotion = useReducedMotion();
  const controlsRef = useRef<OrbitControls | null>(null);
  const actionRef = useRef<((action: CameraAction) => void) | null>(null);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.target.set(0, 1.35, 0);
    // Radius <= 6 stays inside x ±7 / z ±8, away from the corner displays.
    controls.minDistance = 3.5;
    controls.maxDistance = 6;
    controls.minPolarAngle = 1.25;
    controls.maxPolarAngle = 1.55;
    controls.enablePan = false;
    controls.enableDamping = !prefersReducedMotion;
    controls.dampingFactor = 0.12;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.65;
    const handleChange = () => invalidate();
    controls.addEventListener('change', handleChange);
    controls.update();
    controlsRef.current = controls;
    const canvas = gl.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Phòng trưng bày 3D');
    canvas.setAttribute('aria-describedby', 'museum-controls-help');
    canvas.focus({ preventScroll: true });

    const handleAction = (action: CameraAction) => {
      // Flush remaining mouse inertia so keyboard/reset have a precise endpoint.
      const hasDamping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      if (action === 'reset') {
        camera.position.set(0, 2.6, 5.8);
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
      controls.update(); // Applies the same bounds to every input method.
      controls.enableDamping = hasDamping;
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
    const handlePointerDown = () => canvas.focus({ preventScroll: true });
    canvas.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('pointerdown', handlePointerDown);
    return () => {
      canvas.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      controls.removeEventListener('change', handleChange);
      controls.dispose();
      controlsRef.current = null;
      actionRef.current = null;
    };
  }, [camera, gl, invalidate, prefersReducedMotion]);

  useEffect(() => {
    if (command) actionRef.current?.(command.action);
  }, [command]);

  // Demand frames continue only while OrbitControls reports a visible change.
  useFrame(() => controlsRef.current?.update());
  return null;
}
