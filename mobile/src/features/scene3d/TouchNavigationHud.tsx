import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeTouchEvent,
} from 'react-native';
import { palette, radius } from '@/theme/tokens';
import {
  NAVIGATION,
  computePinchStep,
  getJoystickVector,
  type CameraAction,
  type NavigationGestures,
  type NavigationInput,
} from './museumNavigation';

export interface TouchNavigationHudProps {
  input: NavigationInput;
  gestures: NavigationGestures;
  onAction: (action: CameraAction) => void;
  onTap?: (x: number, y: number) => void;
}

const JOYSTICK_RADIUS = 34;

function pinchDistance(touches: readonly NativeTouchEvent[]): number | null {
  const [first, second] = touches;
  return first && second ? Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY) : null;
}

/**
 * Lớp điều khiển cảm ứng trên viewport 3D (MOB-E6-05):
 * - Vuốt 1 ngón trên vùng nhìn để xoay góc camera (yaw/pitch).
 * - Chụm/tách 2 ngón để tiến gần / lùi xa.
 * - Cần joystick ảo góc dưới trái để bước đi tự do mượt mà.
 * - Thanh nút rời (Tiến/Lùi/Trái/Phải/Đặt lại) cho khả năng tiếp cận VoiceOver/TalkBack.
 */
export function TouchNavigationHud({ input, gestures, onAction, onTap }: TouchNavigationHudProps) {
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const onTapRef = useRef(onTap);
  useLayoutEffect(() => {
    onTapRef.current = onTap;
  }, [onTap]);

  const lookRef = useRef<{
    tapId: NativeTouchEvent['identifier'] | undefined;
    previous: NativeTouchEvent | undefined;
    pinch: number | null;
  } | null>(null);

  const cancelLook = useCallback(() => {
    lookRef.current = null;
    gestures.cancel();
  }, [gestures]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') return;
      cancelLook();
      input.stop();
      setKnobOffset({ x: 0, y: 0 });
    });
    return () => subscription.remove();
  }, [cancelLook, input]);

  const lookResponder = useMemo(
    () => {
      const updateTouchSet = (touches: readonly NativeTouchEvent[]) => {
        const look = lookRef.current;
        if (!look) return;
        look.previous = touches.length === 1 ? touches[0] : undefined;
        look.pinch = pinchDistance(touches);
        if (touches.length > 1) gestures.cancel();
      };

      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: ({ nativeEvent: { touches } }) => {
          cancelLook();
          const touch = touches.length === 1 ? touches[0] : undefined;
          if (touch) gestures.start(Number(touch.identifier), touch.pageX, touch.pageY);
          lookRef.current = {
            tapId: touch?.identifier,
            previous: touch,
            pinch: pinchDistance(touches),
          };
        },
        onPanResponderStart: ({ nativeEvent: { touches } }) => updateTouchSet(touches),
        onPanResponderEnd: ({ nativeEvent: { touches } }) => updateTouchSet(touches),
        onPanResponderMove: ({ nativeEvent: { touches } }) => {
          const look = lookRef.current;
          if (!look) return;
          const distance = pinchDistance(touches);
          if (distance !== null) {
            gestures.cancel();
            input.wake();
            if (look.pinch !== null) input.dolly += computePinchStep(look.pinch, distance);
            look.pinch = distance;
            look.previous = undefined;
            return;
          }

          const touch = touches[0];
          if (!touch) return;
          gestures.move(Number(touch.identifier), touch.pageX, touch.pageY);
          if (!gestures.canSelect && look.previous?.identifier === touch.identifier) {
            input.wake();
            input.look.x += (touch.pageX - look.previous.pageX) * NAVIGATION.touchSensitivity;
            input.look.y += (touch.pageY - look.previous.pageY) * NAVIGATION.touchSensitivity;
          }
          look.previous = touch;
          look.pinch = null;
        },
        onPanResponderRelease: ({ nativeEvent: { touches, changedTouches } }) => {
          const tapId = lookRef.current?.tapId;
          const touch = changedTouches.find((item) => item.identifier === tapId);
          if (touch) gestures.move(Number(touch.identifier), touch.pageX, touch.pageY);
          const tap = gestures.canSelect && touches.length === 0 ? touch : undefined;
          cancelLook();
          if (tap) onTapRef.current?.(tap.locationX, tap.locationY);
        },
        onPanResponderTerminate: cancelLook,
      });
    },
    [cancelLook, gestures, input],
  );

  const joystickResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          input.wake();
        },
        onPanResponderMove: (_evt, gestureState) => {
          const dist = Math.hypot(gestureState.dx, gestureState.dy);
          const scale = dist > JOYSTICK_RADIUS ? JOYSTICK_RADIUS / dist : 1;
          const clampedX = gestureState.dx * scale;
          const clampedY = gestureState.dy * scale;
          setKnobOffset({ x: clampedX, y: clampedY });

          const vec = getJoystickVector(gestureState.dx, gestureState.dy, JOYSTICK_RADIUS);
          input.joystick.x = vec.x;
          input.joystick.y = vec.y;
        },
        onPanResponderRelease: () => {
          setKnobOffset({ x: 0, y: 0 });
          input.joystick.x = 0;
          input.joystick.y = 0;
        },
        onPanResponderTerminate: () => {
          setKnobOffset({ x: 0, y: 0 });
          input.joystick.x = 0;
          input.joystick.y = 0;
        },
      }),
    [input],
  );

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Vùng vuốt 1 ngón xoay camera & 2 ngón phóng/thu */}
      <View
        testID="touch-look-surface"
        style={styles.lookArea}
        {...lookResponder.panHandlers}
      />

      {/* Hàng điều khiển ở chân màn hình */}
      <View style={styles.bottomRow} pointerEvents="box-none">
        {/* Cần joystick ảo di chuyển tự do */}
        <View
          testID="virtual-joystick"
          accessible
          accessibilityLabel="Cần di chuyển trong phòng 3D"
          style={styles.joystickBase}
          {...joystickResponder.panHandlers}
        >
          <View
            style={[
              styles.joystickKnob,
              { transform: [{ translateX: knobOffset.x }, { translateY: knobOffset.y }] },
            ]}
          />
        </View>

        {/* Bộ nút điều khiển rời cho người dùng không dùng đa chạm / screen reader */}
        <View style={styles.dpad}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay camera sang trái"
            onPress={() => onAction('left')}
            style={styles.hudBtn}
          >
            <Text style={styles.hudBtnLabel}>◀</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bước tiến về phía trước"
            onPress={() => onAction('forward')}
            style={styles.hudBtn}
          >
            <Text style={styles.hudBtnLabel}>▲</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bước lùi về phía sau"
            onPress={() => onAction('back')}
            style={styles.hudBtn}
          >
            <Text style={styles.hudBtnLabel}>▼</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay camera sang phải"
            onPress={() => onAction('right')}
            style={styles.hudBtn}
          >
            <Text style={styles.hudBtnLabel}>▶</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đặt lại góc nhìn ban đầu"
            onPress={() => onAction('reset')}
            style={[styles.hudBtn, styles.resetBtn]}
          >
            <Text style={styles.hudBtnLabel}>↺</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  lookArea: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: 12,
    gap: 8,
  },
  joystickBase: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(17, 24, 39, 0.65)',
    borderWidth: 1.5,
    borderColor: 'rgba(204, 251, 241, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joystickKnob: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.teal600,
  },
  dpad: {
    flexDirection: 'row',
    gap: 6,
  },
  hudBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(17, 24, 39, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtn: {
    backgroundColor: 'rgba(15, 118, 110, 0.88)',
  },
  hudBtnLabel: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
