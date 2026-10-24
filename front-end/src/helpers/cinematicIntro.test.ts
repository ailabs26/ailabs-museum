import { describe, expect, it } from 'vitest';
import {
  CINEMATIC_DURATION_MS, cinematicPosition, lerpVec3, smoothstep, type Vec3,
} from './cinematicIntro';

describe('smoothstep', () => {
  it('chặn biên và đối xứng ở giữa', () => {
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(2)).toBe(1);
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 6);
  });
});

describe('lerpVec3', () => {
  it('nội suy tuyến tính giữa hai điểm', () => {
    const a: Vec3 = [0, 0, 0];
    const b: Vec3 = [10, -4, 2];
    expect(lerpVec3(a, b, 0)).toEqual([0, 0, 0]);
    expect(lerpVec3(a, b, 1)).toEqual([10, -4, 2]);
    expect(lerpVec3(a, b, 0.5)).toEqual([5, -2, 1]);
  });
});

describe('cinematicPosition', () => {
  const from: Vec3 = [0, 5.2, 9.6];
  const to: Vec3 = [0, 2.6, 5.8];

  it('bắt đầu đúng vị trí xuất phát, chưa xong', () => {
    const r = cinematicPosition(from, to, 0);
    expect(r.position).toEqual(from);
    expect(r.done).toBe(false);
  });

  it('kết thúc đúng vị trí đích và done=true', () => {
    const r = cinematicPosition(from, to, CINEMATIC_DURATION_MS);
    expect(r.position[0]).toBeCloseTo(to[0], 6);
    expect(r.position[1]).toBeCloseTo(to[1], 6);
    expect(r.position[2]).toBeCloseTo(to[2], 6);
    expect(r.done).toBe(true);
  });

  it('done=true khi vượt quá thời lượng', () => {
    expect(cinematicPosition(from, to, CINEMATIC_DURATION_MS + 500).done).toBe(true);
  });
});
