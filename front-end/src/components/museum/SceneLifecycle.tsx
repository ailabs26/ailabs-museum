import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { watchWebglRecovery, type WebglStatus } from '@/helpers/webglRecovery';

export function SceneLifecycle({ onStatus }: { onStatus: (status: WebglStatus) => void }) {
  const { gl, invalidate, setFrameloop } = useThree();
  const statusRef = useRef<WebglStatus>('ready');
  const recoveryRef = useRef<ReturnType<typeof watchWebglRecovery>>();
  const frameCheck = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    const recovery = watchWebglRecovery(gl.domElement, status => {
      statusRef.current = status;
      setFrameloop(status === 'recovering' || status === 'failed' ? 'never' : 'demand');
      onStatus(status);
      if (status === 'verifying') invalidate();
    });
    recoveryRef.current = recovery;
    return () => { recovery.dispose(); clearTimeout(frameCheck.current); };
  }, [gl, invalidate, setFrameloop, onStatus]);
  useFrame(() => {
    if (statusRef.current !== 'verifying' || frameCheck.current !== undefined) return;
    const before = gl.info.render.frame;
    // Runs after R3F has submitted this frame, following Three's context restore.
    frameCheck.current = setTimeout(() => {
      frameCheck.current = undefined;
      if (!gl.getContext().isContextLost() && gl.info.render.frame > before) recoveryRef.current?.frameRendered();
      else invalidate();
    }, 0);
  });
  return null;
}
