/**
 * Bộ đo FPS & frame time thuần TypeScript cho 3D Spike và hiệu năng mobile (MOB-E6-01).
 * Tách khỏi React/Three để unit test chính xác và bám chuẩn phân vị p95 như web (`museumAuditMetrics`).
 */
export interface FpsSnapshot {
  /** FPS trung bình trong cửa sổ trượt gần nhất (0 nếu chưa có mẫu). */
  fps: number;
  /** Thời gian khung hình trung bình (ms). */
  frameTimeMs: number;
  /** Phân vị p95 của thời gian khung hình (ms) — phản ánh độ ổn định thực tế. */
  p95FrameTimeMs: number;
  /** Số khung vượt ngân sách 60 FPS (> 16.67 ms). */
  droppedFrames16ms: number;
  /** Số khung vượt ngân sách 30 FPS (> 33.33 ms). */
  droppedFrames33ms: number;
  /** Tổng số mẫu khoảng thời gian hợp lệ đang nằm trong cửa sổ. */
  sampleCount: number;
  /** Đạt mục tiêu 60 FPS ổn định (≥ 55 FPS trung bình và p95 ≤ 20 ms với ≥ 30 mẫu). */
  meets60FpsTarget: boolean;
}

export interface FpsMeterOptions {
  /** Số mẫu tối đa giữ trong cửa sổ trượt (mặc định 120 ≈ 2 giây ở 60 FPS). */
  windowSize?: number;
  /** Bỏ qua khoảng nghỉ dài hơn ngưỡng này (ví dụ app vào nền rồi quay lại). */
  maxGapMs?: number;
}

const DEFAULT_WINDOW_SIZE = 120;
const DEFAULT_MAX_GAP_MS = 500;
const BUDGET_60_MS = 1000 / 60;
const BUDGET_30_MS = 1000 / 30;
const MIN_SAMPLES_FOR_TARGET = 30;

function nearestRankPercentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index] ?? 0;
}

export class FpsMeter {
  private readonly windowSize: number;
  private readonly maxGapMs: number;
  private deltas: number[] = [];
  private lastTimestampMs: number | null = null;

  constructor(options: FpsMeterOptions = {}) {
    this.windowSize = Math.max(1, Math.floor(options.windowSize ?? DEFAULT_WINDOW_SIZE));
    this.maxGapMs = Math.max(16, options.maxGapMs ?? DEFAULT_MAX_GAP_MS);
  }

  /** Ghi nhận một khung hình bằng timestamp (ms, đơn điệu tăng). */
  recordFrame(timestampMs: number): boolean {
    if (!Number.isFinite(timestampMs) || timestampMs < 0) return false;
    if (this.lastTimestampMs === null) {
      this.lastTimestampMs = timestampMs;
      return false;
    }
    const deltaMs = timestampMs - this.lastTimestampMs;
    if (deltaMs <= 0) {
      // Bỏ qua timestamp không đơn điệu tăng; giữ mốc cũ để tránh âm hóa dữ liệu.
      return false;
    }
    this.lastTimestampMs = timestampMs;
    return this.recordDelta(deltaMs);
  }

  /** Ghi nhận trực tiếp delta giữa hai khung hình (ms). Bỏ qua gap khi app tạm dừng nền. */
  recordDelta(deltaMs: number): boolean {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0 || deltaMs > this.maxGapMs) {
      return false;
    }
    this.deltas.push(deltaMs);
    if (this.deltas.length > this.windowSize) {
      this.deltas.shift();
    }
    return true;
  }

  /** Xóa toàn bộ mẫu và mốc thời gian (ví dụ khi resume từ background hoặc reset spike). */
  reset(): void {
    this.deltas = [];
    this.lastTimestampMs = null;
  }

  getSnapshot(): FpsSnapshot {
    const count = this.deltas.length;
    if (count === 0) {
      return {
        fps: 0,
        frameTimeMs: 0,
        p95FrameTimeMs: 0,
        droppedFrames16ms: 0,
        droppedFrames33ms: 0,
        sampleCount: 0,
        meets60FpsTarget: false,
      };
    }

    let totalMs = 0;
    let dropped16 = 0;
    let dropped33 = 0;
    for (const ms of this.deltas) {
      totalMs += ms;
      if (ms > BUDGET_60_MS) dropped16 += 1;
      if (ms > BUDGET_30_MS) dropped33 += 1;
    }

    const avgMs = totalMs / count;
    const fps = avgMs > 0 ? 1000 / avgMs : 0;
    const p95Ms = nearestRankPercentile(this.deltas, 0.95);

    return {
      fps: Math.round(fps * 10) / 10,
      frameTimeMs: Math.round(avgMs * 100) / 100,
      p95FrameTimeMs: Math.round(p95Ms * 100) / 100,
      droppedFrames16ms: dropped16,
      droppedFrames33ms: dropped33,
      sampleCount: count,
      meets60FpsTarget: count >= MIN_SAMPLES_FOR_TARGET && fps >= 55 && p95Ms <= 20,
    };
  }
}
