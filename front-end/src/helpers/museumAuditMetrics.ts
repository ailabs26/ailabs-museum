import { z } from 'zod';

const nonnegative = z.number().finite().nonnegative();
const scalar = z.union([z.string().max(4000), z.number().finite(), z.boolean(), z.null()]);
export const auditMetadataSchema = z.object({
  buildSha: z.string().regex(/^[a-f\d]{40}$/i),
  device: z.string().min(1).max(500), conditions: z.string().min(1).max(4000),
  scenario: z.string().regex(/^P(0[1-9]|10)$/),
  kind: z.enum(['continuous', 'idle', 'startup', 'lifecycle']),
  source: z.enum(['fixture', 'live']), target: z.enum(['desktop', 'mobile']),
}).strict();
export type AuditMetadata = z.infer<typeof auditMetadataSchema>;
export const auditResourceSchema = z.object({
  at: nonnegative, rendererId: nonnegative.int(), calls: nonnegative.int(), triangles: nonnegative.int(),
  geometries: nonnegative.int(), textures: nonnegative.int(), programs: nonnegative.int(),
  heapBytes: nonnegative.nullable(),
}).strict();
export type AuditResource = z.infer<typeof auditResourceSchema>;
export const museumAuditRunSchema = z.object({
  schemaVersion: z.literal(1), metadata: auditMetadataSchema,
  wallTime: z.string().datetime({ offset: true }), startedAt: nonnegative, endedAt: nonnegative.nullable(),
  // [render submission start (ms), synchronous render call elapsed (ms), renderer lifetime ID]
  frames: z.array(z.tuple([nonnegative, nonnegative, nonnegative.int()])).max(120_000),
  resources: z.array(auditResourceSchema).max(1200),
  events: z.array(z.object({ at: nonnegative, type: z.string().min(1).max(80), detail: z.record(scalar) }).strict()).max(4000),
  environment: z.record(scalar), droppedSamples: nonnegative.int(),
}).strict().superRefine((run, context) => {
  const end = run.endedAt ?? Infinity;
  if (end < run.startedAt) context.addIssue({ code: 'custom', message: 'End precedes start' });
  let previous = -Infinity;
  for (const [at] of run.frames) {
    if (at < run.startedAt || at > end || at <= previous) context.addIssue({ code: 'custom', message: 'Invalid frame timestamp order/range' });
    previous = at;
  }
  for (const item of [...run.events, ...run.resources]) {
    if (item.at < run.startedAt || item.at > end) context.addIssue({ code: 'custom', message: 'Observation outside capture' });
  }
});
export type MuseumAuditRun = z.infer<typeof museumAuditRunSchema>;
export const museumAuditWorkloadSchema = z.object({
  roomId: z.string().min(1), exhibits: nonnegative.int(), visibleExhibits: nonnegative.int(),
  tier: z.enum(['low', 'balanced']), dprCap: nonnegative.positive(), shadowSize: nonnegative.int(), anisotropy: nonnegative.positive(),
  viewportWidth: nonnegative.int().positive(), viewportHeight: nonnegative.int().positive(),
  renderWidth: nonnegative.int().positive(), renderHeight: nonnegative.int().positive(), devicePixelRatio: nonnegative.positive(),
  expectedGlbAssets: nonnegative.int(), readyGlbAssets: nonnegative.int(), failedGlbAssets: nonnegative.int(), failedGlbRenders: nonnegative.int(), xrPresenting: z.boolean(),
});

/** Nearest rank; null for missing data, no interpolation/rounding of raw measurements. */
function percentile(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

export function analyzeMuseumAudit(input: unknown) {
  const run = museumAuditRunSchema.parse(input);
  const intervals: number[] = [];
  let segments = 0;
  for (let i = 1; i < run.frames.length; i++) {
    if (run.frames[i][2] === run.frames[i - 1][2]) intervals.push(run.frames[i][0] - run.frames[i - 1][0]);
    else segments++;
  }
  const durationMs = (run.endedAt ?? run.startedAt) - run.startedAt;
  const issues: string[] = [];
  if (run.endedAt === null) issues.push('still-recording');
  if (durationMs < 30_000) issues.push('capture-shorter-than-30s');
  if (intervals.length < 100) issues.push('fewer-than-100-intervals');
  if (run.droppedSamples) issues.push('samples-dropped');
  if (segments) issues.push('multiple-renderer-lifetimes');
  if (run.events.some(event => ['hidden', 'context-lost', 'render-error', 'pagehide', 'observer-error', 'viewport-changed'].includes(event.type))) issues.push('capture-interrupted');
  const workloads = run.events.filter(event => event.type === 'workload').map(event => museumAuditWorkloadSchema.safeParse(event.detail));
  if (!workloads.length || workloads.some(workload => !workload.success)) issues.push('workload-unavailable');
  const observedWorkloads = workloads.flatMap(workload => workload.success ? [workload.data] : []);
  if (new Set(observedWorkloads.map(workload => JSON.stringify(workload))).size > 1) issues.push('workload-changed');
  if (observedWorkloads.some(workload => workload.expectedGlbAssets !== workload.readyGlbAssets || workload.failedGlbAssets > 0 || workload.failedGlbRenders > 0)) issues.push('incomplete-glb-workload');
  const lastAt = run.frames.at(-1)?.[0] ?? run.startedAt;
  const firstAt = run.frames[0]?.[0] ?? run.startedAt;
  if (firstAt - run.startedAt > 1000 || (run.endedAt ?? lastAt) - lastAt > 1000 || intervals.some(ms => ms > 1000)) issues.push('continuous-coverage-gap');
  if (run.metadata.kind !== 'continuous') issues.push('not-continuous-workload');
  const fps = run.metadata.kind === 'idle' ? [] : intervals.map(ms => 1000 / ms);
  const slowest = [...intervals].sort((a, b) => b - a).slice(0, Math.ceil(intervals.length / 100));
  const over = (budget: number) => ({ count: intervals.filter(ms => ms > budget).length, ratio: intervals.length ? intervals.filter(ms => ms > budget).length / intervals.length : null });
  const tasks = run.events.filter(event => event.type === 'longtask');
  return {
    schemaVersion: 1, metadata: run.metadata, durationMs, renderedFrames: run.frames.length, intervalCount: intervals.length,
    eligible: issues.length === 0, issues,
    frame: {
      meanFps: fps.length ? intervals.length * 1000 / intervals.reduce((sum, ms) => sum + ms, 0) : null,
      medianFps: percentile(fps, .5), p5Fps: percentile(fps, .05),
      onePercentLowFps: fps.length >= 100 ? 1000 / (slowest.reduce((sum, ms) => sum + ms, 0) / slowest.length) : null,
      medianMs: percentile(intervals, .5), p95Ms: percentile(intervals, .95), p99Ms: percentile(intervals, .99),
      over16_67: over(16.67), over33_33: over(33.33),
      submissionCpuMedianMs: percentile(run.frames.map(frame => frame[1]), .5),
      submissionCpuP95Ms: percentile(run.frames.map(frame => frame[1]), .95),
    },
    longTasks: { count: tasks.length, totalMs: tasks.reduce((sum, task) => sum + (typeof task.detail.durationMs === 'number' ? task.detail.durationMs : 0), 0) },
    resources: { first: run.resources[0] ?? null, last: run.resources.at(-1) ?? null },
    gpuMemory: { classification: 'unavailable', bytes: null }, gpuTimeMs: null, confirmedDisplayedDrops: null,
  };
}
