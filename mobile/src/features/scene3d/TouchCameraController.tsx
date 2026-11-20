import { useEffect, useMemo, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber/native';
import { Euler, PerspectiveCamera, Vector3 } from 'three';
import { MUSEUM_ROOM_SIZE } from './museumTypes';
import {
  INITIAL_CAMERA_POSITION,
  INITIAL_CAMERA_TARGET,
  NAVIGATION,
  applyLook,
  getMuseumFov,
  moveClampedToRoom,
  stepMovement,
  type CameraAction,
  type MovePositionHandler,
  type NavigationCollider,
  type NavigationInput,
} from './museumNavigation';

export interface TouchCameraControllerProps {
  input: NavigationInput;
  commandHandler: MutableRefObject<((action: CameraAction) => void) | null>;
  reducedMotion?: boolean;
  colliders?: readonly NavigationCollider[];
  moveHandler?: MovePositionHandler;
}

/**
 * Bộ điều khiển camera cảm ứng chạy trong vòng lặp `useFrame` của R3F Native (MOB-E6-05).
 * Hỗ trợ xoay cảm ứng có quán tính, di chuyển joystick mượt, chụm/tách 2 ngón tiến lùi,
 * điều khiển rời cho VoiceOver/TalkBack và tôn trọng OS Reduce Motion.
 */
export function TouchCameraController({
  input,
  commandHandler,
  reducedMotion = false,
  colliders = [],
  moveHandler = moveClampedToRoom,
}: TouchCameraControllerProps) {
  const { camera, size } = useThree();

  const runtime = useMemo(
    () => ({
      velocity: new Vector3(),
      euler: new Euler(0, 0, 0, 'YXZ'),
      look: { yaw: 0, pitch: 0 },
      goal: { yaw: 0, pitch: 0 },
      isWalking: false,
    }),
    [],
  );

  // Điều chỉnh FOV tự động theo tỷ lệ màn hình dọc/ngang mobile.
  useEffect(() => {
    if (camera instanceof PerspectiveCamera && size.width > 0 && size.height > 0) {
      camera.fov = getMuseumFov(size.width / size.height);
      camera.updateProjectionMatrix();
    }
  }, [camera, size.width, size.height]);

  useEffect(() => {
    const syncLookFromCamera = () => {
      runtime.euler.setFromQuaternion(camera.quaternion, 'YXZ');
      runtime.look.yaw = runtime.goal.yaw = runtime.euler.y;
      runtime.look.pitch = runtime.goal.pitch = runtime.euler.x;
    };

    const stop = () => {
      input.joystick.x = 0;
      input.joystick.y = 0;
      input.look.x = 0;
      input.look.y = 0;
      input.dolly = 0;
      runtime.velocity.set(0, 0, 0);
      runtime.isWalking = false;
      syncLookFromCamera();
    };

    input.stop = stop;
    syncLookFromCamera();

    commandHandler.current = (action: CameraAction) => {
      if (action === 'reset') {
        stop();
        camera.position.set(...INITIAL_CAMERA_POSITION);
        camera.lookAt(...INITIAL_CAMERA_TARGET);
        syncLookFromCamera();
        return;
      }

      if (action === 'forward' || action === 'back') {
        const step = action === 'forward' ? 0.6 : -0.6;
        moveHandler(
          camera.position,
          -Math.sin(runtime.look.yaw) * step,
          -Math.cos(runtime.look.yaw) * step,
          MUSEUM_ROOM_SIZE,
          colliders,
        );
        return;
      }

      applyLook(
        runtime.goal,
        action === 'left' ? -45 : action === 'right' ? 45 : 0,
        action === 'up' ? -24 : action === 'down' ? 24 : 0,
        NAVIGATION.touchSensitivity,
      );
      runtime.look.yaw = runtime.goal.yaw;
      runtime.look.pitch = runtime.goal.pitch;
      runtime.euler.set(runtime.look.pitch, runtime.look.yaw, 0, 'YXZ');
      camera.quaternion.setFromEuler(runtime.euler);
    };

    return () => {
      commandHandler.current = null;
      input.stop = () => {};
    };
  }, [camera, colliders, commandHandler, input, moveHandler, runtime]);

  useFrame((_state, rawDelta) => {
    const delta = Math.max(0, Math.min(NAVIGATION.maxDelta, rawDelta));

    if (input.look.x !== 0 || input.look.y !== 0) {
      applyLook(runtime.goal, input.look.x, input.look.y, 1);
      input.look.x = 0;
      input.look.y = 0;
    }

    const lookDelta =
      Math.abs(runtime.goal.yaw - runtime.look.yaw) +
      Math.abs(runtime.goal.pitch - runtime.look.pitch);
    if (lookDelta > 1e-5) {
      const blend = reducedMotion ? 1 : 1 - Math.exp(-24 * delta);
      runtime.look.yaw += (runtime.goal.yaw - runtime.look.yaw) * blend;
      runtime.look.pitch += (runtime.goal.pitch - runtime.look.pitch) * blend;
      runtime.euler.set(runtime.look.pitch, runtime.look.yaw, 0, 'YXZ');
      camera.quaternion.setFromEuler(runtime.euler);
    }

    if (input.dolly !== 0) {
      const step = input.dolly;
      input.dolly = 0;
      moveHandler(
        camera.position,
        -Math.sin(runtime.look.yaw) * step,
        -Math.cos(runtime.look.yaw) * step,
        MUSEUM_ROOM_SIZE,
        colliders,
      );
    }

    stepMovement(
      camera.position,
      runtime.velocity,
      input.joystick,
      runtime.look.yaw,
      input.sprint,
      delta,
      MUSEUM_ROOM_SIZE,
      colliders,
      moveHandler,
    );

    if (input.joystick.x !== 0 || input.joystick.y !== 0) {
      runtime.isWalking = true;
    }
    if (runtime.isWalking && Math.abs(camera.position.y - NAVIGATION.eyeHeight) > 1e-4) {
      const blendY = reducedMotion ? 1 : 1 - Math.exp(-12 * delta);
      camera.position.y += (NAVIGATION.eyeHeight - camera.position.y) * blendY;
    }
  });

  return null;
}
