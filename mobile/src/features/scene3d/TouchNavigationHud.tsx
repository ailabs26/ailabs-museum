import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
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
}

const JOYSTICK_RADIUS = 34;

/**
 * Lớp điều khiển cảm ứng trên viewport 3D (MOB-E6-05):
 * - Vuốt 1 ngón trên vùng nhìn để xoay góc camera (yaw/pitch).
 * - Chụm/tách 2 ngón để tiến gần / lùi xa.
 * - Cần joystick ảo góc dưới trái để bước đi tự do mượt mà.
 * - Thanh nút rời (Tiến/Lùi/Trái/Phải/Đặt lại) cho khả năng tiếp cận VoiceOver/TalkBack.
 */
export function TouchNavigationHud({ input, gestures, onAction }: TouchNavigationHudProps) {
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const prevTouchRef = useRef<{ x: number; y: number } | null>(null);
  const prevPinchDistRef = useRef<number | null>(null);

  const lookResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gestureState) =>
          Math.hypot(gestureState.dx, gestureState.dy) > 4 || gestureState.numberActiveTouches >= 2,
        onPanResponderGrant: (evt) => {
          const touches = evt.nativeEvent.touches;
          if (touches.length === 1 && touches[0]) {
            gestures.start(1, touches[0].pageX, touches[0].pageY);
            prevTouchRef.current = { x: touches[0].pageX, y: touches[0].pageY };
            prevPinchDistRef.current = null;
          } else if (touches.length >= 2 && touches[0] && touches[1]) {
            gestures.cancel();
            prevPinchDistRef.current = Math.hypot(
              touches[1].pageX - touches[0].pageX,
              touches[1].pageY - touches[0].pageY,
            );
          }
          input.wake();
        },
        onPanResponderMove: (evt) => {
          const touches = evt.nativeEvent.touches;
          if (touches.length >= 2 && touches[0] && touches[1]) {
            const dist = Math.hypot(
              touches[1].pageX - touches[0].pageX,
              touches[1].pageY - touches[0].pageY,
            );
            if (prevPinchDistRef.current !== null) {
              input.dolly += computePinchStep(prevPinchDistRef.current, dist);
            }
            prevPinchDistRef.current = dist;
            prevTouchRef.current = null;
            return;
          }

          if (touches.length === 1 && touches[0]) {
            const current = { x: touches[0].pageX, y: touches[0].pageY };
            gestures.move(1, current.x, current.y);
            if (prevTouchRef.current) {
              input.look.x += (current.x - prevTouchRef.current.x) * NAVIGATION.touchSensitivity;
              input.look.y += (current.y - prevTouchRef.current.y) * NAVIGATION.touchSensitivity;
            }
            prevTouchRef.current = current;
            prevPinchDistRef.current = null;
          }
        },
        onPanResponderRelease: () => {
          gestures.end(1);
          prevTouchRef.current = null;
          prevPinchDistRef.current = null;
        },
        onPanResponderTerminate: () => {
          gestures.cancel();
          prevTouchRef.current = null;
          prevPinchDistRef.current = null;
        },
      }),
    [gestures, input],
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
    justifyContent: 'space-between',
  },
  lookArea: {
    flex: 1,
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
