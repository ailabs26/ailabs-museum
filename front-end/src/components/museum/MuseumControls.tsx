import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function MuseumControls() {
  const { camera, gl, invalidate } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.target.set(0, 1.35, 0);
    // Radius <= 6 stays inside x ±7 / z ±8, away from the corner displays.
    controls.minDistance = 3.5;
    controls.maxDistance = 6;
    controls.minPolarAngle = 1.25;
    controls.maxPolarAngle = 1.55;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.65;
    const handleChange = () => invalidate();
    controls.addEventListener('change', handleChange);
    controls.update();
    controlsRef.current = controls;
    return () => {
      controls.removeEventListener('change', handleChange);
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl, invalidate]);

  // Demand frames continue only while OrbitControls reports a visible change.
  useFrame(() => controlsRef.current?.update());
  return null;
}
