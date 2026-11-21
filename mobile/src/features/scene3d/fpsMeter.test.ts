import { FpsMeter } from './fpsMeter';

describe('FpsMeter (MOB-E6-01)', () => {
  it('trả snapshot rỗng an toàn khi chưa có mẫu', () => {
    const meter = new FpsMeter();
    expect(meter.getSnapshot()).toEqual({
      fps: 0,
      frameTimeMs: 0,
      p95FrameTimeMs: 0,
      droppedFrames16ms: 0,
      droppedFrames33ms: 0,
      sampleCount: 0,
      meets60FpsTarget: false,
    });
  });

  it('xác nhận đạt mục tiêu 60 FPS ổn định với 60 khung hình đều 16.6ms', () => {
    const meter = new FpsMeter();
    let t = 1000;
    meter.recordFrame(t);
    for (let i = 0; i < 60; i++) {
      t += 16.6;
      expect(meter.recordFrame(t)).toBe(true);
    }

    const snap = meter.getSnapshot();
    expect(snap.sampleCount).toBe(60);
    expect(snap.fps).toBeGreaterThanOrEqual(59.5);
    expect(snap.p95FrameTimeMs).toBeLessThanOrEqual(16.7);
    expect(snap.droppedFrames16ms).toBe(0);
    expect(snap.droppedFrames33ms).toBe(0);
    expect(snap.meets60FpsTarget).toBe(true);
  });

  it('phát hiện máy yếu chạy 30 FPS và đếm đúng khung rớt', () => {
    const meter = new FpsMeter();
    for (let i = 0; i < 40; i++) {
      meter.recordDelta(35);
    }
    const snap = meter.getSnapshot();
    expect(snap.fps).toBeCloseTo(28.6, 1);
    expect(snap.droppedFrames16ms).toBe(40);
    expect(snap.droppedFrames33ms).toBe(40);
    expect(snap.meets60FpsTarget).toBe(false);
  });

  it('bỏ qua khoảng nghỉ dài khi app vào nền (background resume gap) và timestamp bất hợp lệ', () => {
    const meter = new FpsMeter({ maxGapMs: 500 });
    expect(meter.recordFrame(Number.NaN)).toBe(false);
    expect(meter.recordFrame(-5)).toBe(false);

    meter.recordFrame(100);
    expect(meter.recordFrame(116.5)).toBe(true);
    // Timestamp không đơn điệu tăng bị bỏ qua, không làm lệch mốc.
    expect(meter.recordFrame(110)).toBe(false);
    // App tạm ẩn 4 giây rồi quay lại -> delta 4000ms > 500ms phải bị loại khỏi mẫu FPS.
    expect(meter.recordFrame(4116.5)).toBe(false);
    // Khung tiếp theo lại đo bình thường.
    expect(meter.recordFrame(4133)).toBe(true);

    const snap = meter.getSnapshot();
    expect(snap.sampleCount).toBe(2);
    expect(snap.fps).toBeGreaterThan(59);
  });

  it('giữ đúng kích thước cửa sổ trượt và reset sạch dữ liệu', () => {
    const meter = new FpsMeter({ windowSize: 5 });
    for (let i = 0; i < 5; i++) meter.recordDelta(40);
    for (let i = 0; i < 5; i++) meter.recordDelta(16);

    const snap = meter.getSnapshot();
    expect(snap.sampleCount).toBe(5);
    expect(snap.frameTimeMs).toBe(16);
    expect(snap.droppedFrames16ms).toBe(0);

    meter.reset();
    expect(meter.getSnapshot().sampleCount).toBe(0);
  });
});
