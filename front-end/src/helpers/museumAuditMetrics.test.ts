import { describe, expect, it } from 'vitest';
import { analyzeMuseumAudit, museumAuditRunSchema } from './museumAuditMetrics';
import { MuseumAuditRecorder } from './museumAudit';

const metadata = { buildSha: 'a'.repeat(40), device: 'unit fixture', conditions: 'synthetic logic test', scenario: 'P03', kind: 'continuous', source: 'fixture', target: 'desktop' } as const;
const workload = { roomId: 'fixture-room', exhibits: 5, visibleExhibits: 5, tier: 'balanced', dprCap: 1.5, shadowSize: 1024, anisotropy: 4,
  viewportWidth: 1280, viewportHeight: 720, renderWidth: 1280, renderHeight: 720, devicePixelRatio: 1,
  expectedGlbAssets: 0, readyGlbAssets: 0, failedGlbAssets: 0, failedGlbRenders: 0, xrPresenting: false };
function run(intervals: number[]) {
  const recorder = new MuseumAuditRecorder();
  recorder.start(metadata, 0, '2026-11-04T00:00:00.000Z');
  recorder.event(0, 'workload', workload);
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
    { viewportWidth: 720, viewportHeight: 1280 }, { tier: 'low' }, { xrPresenting: true },
    { exhibits: 6 }, { renderWidth: 1920 }, { devicePixelRatio: 2 },
  ])('rejects same-renderer captures mixing workload/quality/orientation %#', change => {
    const raw = run(Array<number>(2000).fill(16));
    raw.events.push({ at: 20_000, type: 'workload', detail: { ...workload, ...change } });
    expect(analyzeMuseumAudit(raw).issues).toContain('workload-changed');
    expect(analyzeMuseumAudit(raw).eligible).toBe(false);
  });

  it('requires observed complete GLB workload and rejects known render failure or transient resize', () => {
    const raw = run(Array<number>(2000).fill(16));
    expect(analyzeMuseumAudit({ ...raw, events: [] }).issues).toContain('workload-unavailable');
    for (const change of [{ expectedGlbAssets: 1 }, { failedGlbAssets: 1 }, { failedGlbRenders: 1 }]) {
      expect(analyzeMuseumAudit({ ...raw, events: [{ at: 0, type: 'workload', detail: { ...workload, ...change } }] }).issues).toContain('incomplete-glb-workload');
    }
    expect(analyzeMuseumAudit({ ...raw, events: [...raw.events, { at: 1, type: 'viewport-changed', detail: {} }] }).eligible).toBe(false);
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
