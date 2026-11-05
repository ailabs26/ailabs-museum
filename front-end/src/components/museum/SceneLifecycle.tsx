import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { watchWebglRecovery, type WebglStatus } from '@/helpers/webglRecovery';
import { guardWebglRender } from '@/helpers/webglRenderGuard';

export function SceneLifecycle({ onStatus, auditWorkload = {} }: { onStatus: (status: WebglStatus) => void; auditWorkload?: Record<string, string | number | boolean | null> }) {
  const { gl, invalidate, setFrameloop } = useThree();
  const statusRef = useRef<WebglStatus>('ready');
  const recoveryRef = useRef<ReturnType<typeof watchWebglRecovery>>();
  const frameCheck = useRef<ReturnType<typeof setTimeout>>();
  const workloadRef = useRef(auditWorkload); workloadRef.current = auditWorkload;
  useEffect(() => {
    const unguard = guardWebglRender(gl);
    let isDisposed = false;
    let detachAudit: (() => void) | undefined;
    if (new URLSearchParams(window.location.search).get('museumAudit') === '1') {
      void import('@/helpers/museumAuditBrowser').then(({ attachMuseumAudit }) => {
        if (!isDisposed) detachAudit = attachMuseumAudit(gl, () => workloadRef.current);
      });
    }
    const recovery = watchWebglRecovery(gl.domElement, status => {
      statusRef.current = status;
      setFrameloop(status === 'recovering' || status === 'failed' ? 'never' : 'demand');
      onStatus(status);
      if (status === 'verifying') invalidate();
    });
    recoveryRef.current = recovery;
    return () => { isDisposed = true; detachAudit?.(); recovery.dispose(); unguard(); clearTimeout(frameCheck.current); };
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
