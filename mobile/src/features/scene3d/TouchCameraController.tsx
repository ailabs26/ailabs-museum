import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber/native';
import { Euler, PerspectiveCamera, Vector3 } from 'three';
import { MUSEUM_ROOM_SIZE, type MuseumDisplay } from './museumTypes';
import {
  INITIAL_CAMERA_POSITION,
  INITIAL_CAMERA_TARGET,
  NAVIGATION,
  applyLook,
  getMuseumFov,
  stepMovement,
  type CameraAction,
  type MovePositionHandler,
  type NavigationCollider,
  type NavigationInput,
} from './museumNavigation';
import {
  findSafeNavigationPoint,
  moveWithCollisions,
  planExhibitFocusRoute,
  sampleFocusRoute,
  type PlannedFocusRoute,
} from './museumCollision';

export interface FocusExhibitRequest {
  exhibit: MuseumDisplay;
  displays: readonly MuseumDisplay[];
  issuedAt: number;
}

export interface TouchCameraControllerProps {
  input: NavigationInput;
  commandHandler: MutableRefObject<((action: CameraAction) => void) | null>;
  reducedMotion?: boolean;
  colliders?: readonly NavigationCollider[];
  moveHandler?: MovePositionHandler;
  focusRequest?: FocusExhibitRequest | null;
}

interface ActiveFocusTransition {
  route: PlannedFocusRoute;
  fromY: number;
  fromTarget: Vector3;
  toTarget: Vector3;
  elapsed: number;
  durationSec: number;
}

/**
 * Bộ điều khiển camera cảm ứng + va chạm + lộ trình di chuyển an toàn trong phòng 3D
 * (MOB-E6-05, MOB-E6-06). Mặc định dùng `moveWithCollisions` để không xuyên tường hay bục.
 */
export function TouchCameraController({
  input,
  commandHandler,
  reducedMotion = false,
  colliders = [],
  moveHandler = moveWithCollisions,
  focusRequest = null,
}: TouchCameraControllerProps) {
  const { camera, size } = useThree();
  const transitionRef = useRef<ActiveFocusTransition | null>(null);
  const lastHandledFocusRef = useRef<number>(-1);

  const runtime = useMemo(
    () => ({
      velocity: new Vector3(),
      euler: new Euler(0, 0, 0, 'YXZ'),
      look: { yaw: 0, pitch: 0 },
      goal: { yaw: 0, pitch: 0 },
      direction: new Vector3(),
      lerpTarget: new Vector3(),
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

  // Nếu dữ liệu phòng/bục cập nhật và camera bị kẹt bên trong bục -> tự đẩy ra biên an toàn gần nhất.
  useEffect(() => {
    const safe = findSafeNavigationPoint(
      { x: camera.position.x, y: camera.position.z },
      MUSEUM_ROOM_SIZE,
      colliders,
    );
    if (safe && (safe.x !== camera.position.x || safe.y !== camera.position.z)) {
      transitionRef.current = null;
      camera.position.x = safe.x;
      camera.position.z = safe.y;
    }
  }, [camera, colliders]);

  useEffect(() => {
    const syncLookFromCamera = () => {
      runtime.euler.setFromQuaternion(camera.quaternion, 'YXZ');
      runtime.look.yaw = runtime.goal.yaw = runtime.euler.y;
      runtime.look.pitch = runtime.goal.pitch = runtime.euler.x;
    };

    const stop = () => {
      transitionRef.current = null;
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
    input.wake = () => {
      if (transitionRef.current) {
        transitionRef.current = null;
        syncLookFromCamera();
      }
    };
    syncLookFromCamera();

    commandHandler.current = (action: CameraAction) => {
      transitionRef.current = null;
      if (action === 'reset') {
        stop();
        const safe = findSafeNavigationPoint(
          { x: INITIAL_CAMERA_POSITION[0], y: INITIAL_CAMERA_POSITION[2] },
          MUSEUM_ROOM_SIZE,
          colliders,
        );
        camera.position.set(
          safe?.x ?? INITIAL_CAMERA_POSITION[0],
          INITIAL_CAMERA_POSITION[1],
          safe?.y ?? INITIAL_CAMERA_POSITION[2],
        );
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
      input.wake = () => {};
    };
  }, [camera, colliders, commandHandler, input, moveHandler, runtime]);

  // Lập lộ trình không va chạm khi người dùng chọn "Đến gần hiện vật".
  useEffect(() => {
    if (!focusRequest || focusRequest.issuedAt === lastHandledFocusRef.current) return;
    lastHandledFocusRef.current = focusRequest.issuedAt;

    const route = planExhibitFocusRoute(
      [camera.position.x, camera.position.y, camera.position.z],
      focusRequest.exhibit,
      focusRequest.displays,
      MUSEUM_ROOM_SIZE,
    );
    if (!route) return;

    runtime.velocity.set(0, 0, 0);
    const toTarget = new Vector3(...route.target);

    if (reducedMotion) {
      const dest = sampleFocusRoute(route, 1);
      camera.position.set(dest.x, route.destinationY, dest.y);
      camera.lookAt(toTarget);
      runtime.euler.setFromQuaternion(camera.quaternion, 'YXZ');
      runtime.look.yaw = runtime.goal.yaw = runtime.euler.y;
      runtime.look.pitch = runtime.goal.pitch = runtime.euler.x;
      transitionRef.current = null;
      return;
    }

    camera.getWorldDirection(runtime.direction);
    const fromTarget = camera.position
      .clone()
      .addScaledVector(runtime.direction, Math.max(1, camera.position.distanceTo(toTarget)));

    transitionRef.current = {
      route,
      fromY: camera.position.y,
      fromTarget,
      toTarget,
      elapsed: 0,
      durationSec: Math.max(0.55, Math.min(2.2, route.totalLength / 3.2)),
    };
  }, [camera, focusRequest, reducedMotion, runtime]);

  useFrame((_state, rawDelta) => {
    const delta = Math.max(0, Math.min(NAVIGATION.maxDelta, rawDelta));

    // Nếu người dùng bắt đầu điều khiển tay -> hủy lộ trình tự động ngay.
    if (
      transitionRef.current &&
      (input.look.x !== 0 ||
        input.look.y !== 0 ||
        input.joystick.x !== 0 ||
        input.joystick.y !== 0 ||
        input.dolly !== 0)
    ) {
      transitionRef.current = null;
      runtime.euler.setFromQuaternion(camera.quaternion, 'YXZ');
      runtime.look.yaw = runtime.goal.yaw = runtime.euler.y;
      runtime.look.pitch = runtime.goal.pitch = runtime.euler.x;
    }

    const activeTransition = transitionRef.current;
    if (activeTransition) {
      activeTransition.elapsed += delta;
      const progress = Math.min(1, activeTransition.elapsed / activeTransition.durationSec);
      const eased = progress * progress * (3 - 2 * progress);
      const pos = sampleFocusRoute(activeTransition.route, eased);
      const y =
        activeTransition.fromY + (activeTransition.route.destinationY - activeTransition.fromY) * eased;
      camera.position.set(pos.x, y, pos.y);
      runtime.lerpTarget.lerpVectors(
        activeTransition.fromTarget,
        activeTransition.toTarget,
        eased,
      );
      camera.lookAt(runtime.lerpTarget);

      if (progress >= 1) {
        transitionRef.current = null;
        runtime.euler.setFromQuaternion(camera.quaternion, 'YXZ');
        runtime.look.yaw = runtime.goal.yaw = runtime.euler.y;
        runtime.look.pitch = runtime.goal.pitch = runtime.euler.x;
      }
      return;
    }

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
