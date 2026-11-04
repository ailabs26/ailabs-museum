import { describe, expect, it } from 'vitest';
import { analyzeMuseumAudit, museumAuditRunSchema } from './museumAuditMetrics';
import { MuseumAuditRecorder } from './museumAudit';

const metadata = { buildSha: 'a'.repeat(40), device: 'unit fixture', conditions: 'synthetic logic test', scenario: 'P03', kind: 'continuous', source: 'fixture', target: 'desktop' } as const;
function run(intervals: number[]) {
  const recorder = new MuseumAuditRecorder();
  recorder.start(metadata, 0, '2026-11-04T00:00:00.000Z');
  recorder.frame(0, 1, 1);
  let time = 0;
  for (const interval of intervals) { time += interval; recorder.frame(time, 2, 1); }
  return recorder.stop(time);
}

describe('audit metric contract', () => {
  it('uses render intervals and nearest-rank tails, not arithmetic mean instantaneous FPS', () => {
    const result = analyzeMuseumAudit(run([10, 20, 40, 10]));
    expect(result.frame.meanFps).toBe(50);
    expect(result.frame.medianFps).toBe(50);
    expect(result.frame.p5Fps).toBe(25);
    expect(result.frame.medianMs).toBe(10);
    expect(result.frame.p95Ms).toBe(40);
    expect(result.frame.p99Ms).toBe(40);
    expect(result.frame.over16_67).toEqual({ count: 2, ratio: 0.5 });
    expect(result.frame.over33_33).toEqual({ count: 1, ratio: 0.25 });
    expect(result.frame.onePercentLowFps).toBeNull();
    expect(result.eligible).toBe(false);
  });

  it('computes 1% low only with enough data and flags short captures', () => {
    const result = analyzeMuseumAudit(run([...Array<number>(99).fill(10), 100]));
    expect(result.frame.onePercentLowFps).toBe(10);
    expect(result.issues).toContain('capture-shorter-than-30s');
  });

  it('does not invent idle FPS or connect different renderer lifetimes', () => {
    const recorder = new MuseumAuditRecorder();
    recorder.start({ ...metadata, kind: 'idle' }, 0, '2026-11-04T00:00:00Z');
    recorder.frame(1000, 2, 1);
    recorder.frame(2000, 2, 2);
    const idle = analyzeMuseumAudit(recorder.stop(30_000));
    expect(idle.frame.meanFps).toBeNull();
    expect(idle.intervalCount).toBe(0);
    expect(idle.renderedFrames).toBe(2);
    expect(analyzeMuseumAudit(run([])).frame.p95Ms).toBeNull();
  });

  it('accepts a complete continuous run and rejects hidden, truncated or interrupted captures', () => {
    const raw = run(Array<number>(2000).fill(16));
    expect(analyzeMuseumAudit(raw).eligible).toBe(true);
    expect(analyzeMuseumAudit({ ...raw, droppedSamples: 1 }).eligible).toBe(false);
    expect(analyzeMuseumAudit({ ...raw, events: [{ at: 20, type: 'hidden', detail: {} }] }).eligible).toBe(false);
    expect(analyzeMuseumAudit({ ...raw, endedAt: 60_000 }).issues).toContain('continuous-coverage-gap');
  });

  it.each([
    null, {},
    { ...run([10]), schemaVersion: 99 },
    { ...run([10]), frames: [[10, -1, 1]] },
    { ...run([10]), frames: [[10, 1, 1], [10, 1, 1]] },
    { ...run([10]), frames: [[11, 1, 1]] },
    { ...run([10]), endedAt: -1 },
    { ...run([10]), frames: [[Number.NaN, 1, 1]] },
  ])('rejects malformed/out-of-range/nonmonotonic raw data %#', raw => {
    expect(() => analyzeMuseumAudit(raw)).toThrow();
  });
});

describe('bounded recorder lifecycle', () => {
  it('records nothing before Start or after Stop and exports a detached schema-valid copy', () => {
    const recorder = new MuseumAuditRecorder();
    recorder.frame(1, 1, 1);
    expect(recorder.snapshot()).toBeNull();
    recorder.start(metadata, 10, '2026-11-04T00:00:00Z');
    recorder.frame(20, 1, 1);
    const stopped = recorder.stop(30);
    recorder.frame(40, 1, 1);
    expect(stopped.frames).toHaveLength(1);
    stopped.frames.length = 0;
    expect(recorder.snapshot()?.frames).toHaveLength(1);
    expect(museumAuditRunSchema.safeParse(JSON.parse(recorder.exportJson())).success).toBe(true);
    expect(() => recorder.start({ ...metadata, buildSha: 'unknown' }, 40, '2026-11-04T00:00:00Z')).toThrow();
  });

  it('bounds frame, resource and event storage and reports dropped observations', () => {
    const recorder = new MuseumAuditRecorder({ frames: 2, resources: 1, events: 1 });
    recorder.start(metadata, 0, '2026-11-04T00:00:00Z');
    for (let i = 1; i <= 3; i++) {
      recorder.frame(i, 1, 1);
      recorder.event(i, 'checkpoint', { number: i });
      recorder.resource(i, { rendererId: 1, calls: i, triangles: i, geometries: i, textures: i, programs: i, heapBytes: null });
    }
    const raw = recorder.stop(4);
    expect(raw.frames).toHaveLength(2);
    expect(raw.events).toHaveLength(1);
    expect(raw.resources).toHaveLength(1);
    expect(raw.droppedSamples).toBe(5);
    expect(analyzeMuseumAudit(raw).eligible).toBe(false);
  });

  it('rejects reentrant start and ignores invalid samples without corrupting export', () => {
    const recorder = new MuseumAuditRecorder();
    recorder.start(metadata, 0, '2026-11-04T00:00:00Z');
    expect(() => recorder.start(metadata, 1, '2026-11-04T00:00:00Z')).toThrow();
    recorder.frame(2, 1, 1);
    recorder.frame(1, 1, 1);
    recorder.frame(3, Number.NaN, 1);
    expect(recorder.stop(4).droppedSamples).toBe(2);
    expect(museumAuditRunSchema.safeParse(recorder.snapshot()).success).toBe(true);
  });
});
