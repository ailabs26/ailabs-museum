import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useReducedMotion } from '@mantine/hooks';
import { INITIAL_CAMERA_POSITION, INITIAL_CAMERA_TARGET } from '@/helpers/museumCamera';
import { CINEMATIC_START_POSITION, cinematicPosition } from '@/helpers/cinematicIntro';
import type { NavigationInput } from '@/helpers/museumNavigation';

/**
 * Hiệu ứng camera điện ảnh khi vừa mở phòng: lia từ góc toàn cảnh trên cao xuống
 * vị trí xuất phát trong ~2s. Luôn KẾT THÚC đúng pose ban đầu (khớp trạng thái look
 * mà MuseumControls đã lưu → không lệch góc), và HỦY ngay khi người dùng tương tác.
 * Bỏ qua khi người dùng bật "giảm chuyển động".
 */
export function CinematicIntro({ input, enabled }: { input: NavigationInput; enabled: boolean }) {
  const { camera, invalidate } = useThree();
  const reduced = useReducedMotion();
  const startedAt = useRef<number | null>(null);
  const done = useRef(false);

  useFrame(() => {
    if (!enabled || done.current || reduced) return;

    if (startedAt.current === null) {
      startedAt.current = performance.now();
      camera.position.set(...CINEMATIC_START_POSITION);
      camera.lookAt(...INITIAL_CAMERA_TARGET);
      invalidate();
      return;
    }

    const interacting = input.keys.size > 0 || input.joystick.x !== 0 || input.joystick.y !== 0
      || input.look.x !== 0 || input.look.y !== 0;
    const elapsed = performance.now() - startedAt.current;
    const { position, done: finished } = cinematicPosition(CINEMATIC_START_POSITION, INITIAL_CAMERA_POSITION, elapsed);

    if (interacting || finished) {
      // Bàn giao: đặt đúng pose ban đầu để không lệch so với look đã lưu.
      camera.position.set(...INITIAL_CAMERA_POSITION);
      camera.lookAt(...INITIAL_CAMERA_TARGET);
      done.current = true;
      invalidate();
      return;
    }

    camera.position.set(...position);
    camera.lookAt(...INITIAL_CAMERA_TARGET);
    invalidate();
  });

  return null;
}
