import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

/**
 * Cầu nối chụp ảnh không gian 3D: render đồng bộ rồi đọc pixel từ canvas WebGL.
 * Cần `gl.preserveDrawingBuffer = true` để `toDataURL` không trả ảnh trắng với
 * frameloop="demand". Ảnh chỉ gồm cảnh 3D, không dính lớp HUD (vốn là HTML).
 */
export function PhotoCapture({ bind }: { bind: (capture: (() => string | null) | null) => void }) {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    bind(() => {
      try {
        if (gl.getContext().isContextLost()) return null;
        gl.render(scene, camera);
        return gl.domElement.toDataURL('image/png');
      } catch {
        return null;
      }
    });
    return () => bind(null);
  }, [gl, scene, camera, bind]);

  return null;
}
