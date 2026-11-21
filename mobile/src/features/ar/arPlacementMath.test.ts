import {
  AR_MAX_SCALE,
  AR_MIN_SCALE,
  arPlacementReducer,
  clampArScale,
  computeArModelTransform,
  createInitialArPlacementState,
  normalizeAngleDeg,
} from './arPlacementMath';

describe('arPlacementMath — đặt mặt phẳng, xoay & zoom AR ổn định (MOB-E9-02)', () => {
  it('chuyển trạng thái scanning -> plane_detected -> placed -> reposition an toàn và từ chối tọa độ NaN', () => {
    let state = createInitialArPlacementState();
    expect(state.status).toBe('scanning');

    state = arPlacementReducer(state, { type: 'PLANE_DETECTED' });
    expect(state.status).toBe('plane_detected');
    expect(state.planeCount).toBe(1);

    // Tọa độ NaN bị từ chối.
    const unchanged = arPlacementReducer(state, {
      type: 'PLACE_AT',
      position: [Number.NaN, 0, -1],
    });
    expect(unchanged.status).toBe('plane_detected');

    state = arPlacementReducer(state, { type: 'PLACE_AT', position: [0.1, -0.5, -1.3] });
    expect(state.status).toBe('placed');
    expect(state.anchorPosition).toEqual([0.1, -0.5, -1.3]);

    state = arPlacementReducer(state, { type: 'REPOSITION' });
    expect(state.status).toBe('plane_detected');
    expect(state.anchorPosition).toBeNull();
  });

  it('xử lý cử chỉ pinch (1=START, 2=MOVE, 3=END) không bị nhân dồn kích thước qua nhiều khung hình', () => {
    let state = arPlacementReducer(createInitialArPlacementState(), {
      type: 'PLACE_AT',
      position: [0, -0.4, -1.2],
    });

    // Bắt đầu pinch ở scale = 1.0
    state = arPlacementReducer(state, { type: 'PINCH_GESTURE', gestureState: 1, scaleFactor: 1 });
    // 10 sự kiện MOVE liên tiếp cùng scaleFactor = 1.5 -> phải giữ ổn định đúng 1.5 (KHÔNG phải 1.5^10!).
    for (let i = 0; i < 10; i++) {
      state = arPlacementReducer(state, {
        type: 'PINCH_GESTURE',
        gestureState: 2,
        scaleFactor: 1.5,
      });
    }
    expect(state.scale).toBe(1.5);

    // Kết thúc cử chỉ -> chốt scale = 1.6 và xóa pinchBaseScale.
    state = arPlacementReducer(state, { type: 'PINCH_GESTURE', gestureState: 3, scaleFactor: 1.6 });
    expect(state.scale).toBe(1.6);
    expect(state.pinchBaseScale).toBeNull();

    // Kẹp biên phóng quá cỡ và thu quá nhỏ.
    state = arPlacementReducer(state, { type: 'PINCH_GESTURE', gestureState: 1, scaleFactor: 1 });
    state = arPlacementReducer(state, { type: 'PINCH_GESTURE', gestureState: 3, scaleFactor: 100 });
    expect(state.scale).toBe(AR_MAX_SCALE);

    state = arPlacementReducer(state, { type: 'PINCH_GESTURE', gestureState: 1, scaleFactor: 1 });
    state = arPlacementReducer(state, {
      type: 'PINCH_GESTURE',
      gestureState: 3,
      scaleFactor: 0.001,
    });
    expect(state.scale).toBe(AR_MIN_SCALE);
  });

  it('xử lý cử chỉ xoay không cộng dồn, chuẩn hóa [0, 360) và hỗ trợ đặt lại transform', () => {
    let state = arPlacementReducer(createInitialArPlacementState(), {
      type: 'PLACE_AT',
      position: [0, -0.4, -1.2],
    });

    state = arPlacementReducer(state, {
      type: 'ROTATE_GESTURE',
      gestureState: 1,
      rotationFactorDeg: 0,
    });
    for (let i = 0; i < 5; i++) {
      state = arPlacementReducer(state, {
        type: 'ROTATE_GESTURE',
        gestureState: 2,
        rotationFactorDeg: -45,
      });
    }
    expect(state.rotationYDeg).toBe(45);
    state = arPlacementReducer(state, {
      type: 'ROTATE_GESTURE',
      gestureState: 3,
      rotationFactorDeg: -90,
    });
    expect(state.rotationYDeg).toBe(90);

    // Bước xoay rời & bước phóng rời.
    state = arPlacementReducer(state, { type: 'STEP_ROTATE', deltaDeg: -120 });
    expect(state.rotationYDeg).toBe(330);
    state = arPlacementReducer(state, { type: 'STEP_SCALE', delta: 0.5 });
    expect(state.scale).toBe(1.5);

    state = arPlacementReducer(state, { type: 'RESET_TRANSFORM' });
    expect(state.scale).toBe(1);
    expect(state.rotationYDeg).toBe(0);
  });

  it('tính vị trí grounded cho GLB chuẩn hóa đặt khít mặt phẳng AR và kẹp giá trị lỗi', () => {
    expect(clampArScale(Number.NaN)).toBe(1);
    expect(clampArScale(-5)).toBe(1);
    expect(normalizeAngleDeg(-30)).toBe(330);
    expect(normalizeAngleDeg(725)).toBe(5);

    const transform = computeArModelTransform(1.2, {
      scale: 0.5,
      offset: [-2, -1, 3],
      size: [1.1, 1.1, 1.1],
      center: [0, 0.55, 0],
      radius: 0.95,
    });
    expect(transform.scale[0]).toBeCloseTo(0.3);
    expect(transform.positionOffset[1]).toBeCloseTo(-0.3);
  });
});
