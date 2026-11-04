// Node >=22.18: native TypeScript stripping reuses exactly the browser metric logic.
import { readFile, stat } from 'node:fs/promises';
import { analyzeMuseumAudit, museumAuditRunSchema, museumAuditWorkloadSchema } from '../src/helpers/museumAuditMetrics.ts';

try {
  const files = process.argv.slice(2);
  if (!files.length) throw new Error('Usage: node scripts/analyze-museum-audit.mjs <raw.json> [raw2.json ...]');
  const runs = [];
  const groups = new Map();
  for (const file of files) {
    if ((await stat(file)).size > 64 * 1024 * 1024) throw new Error('Audit JSON exceeds 64 MiB');
    const raw = museumAuditRunSchema.parse(JSON.parse(await readFile(file, 'utf8')));
    const result = analyzeMuseumAudit(raw);
    runs.push({ file, ...result });
    const workloads = raw.events.filter(event => event.type === 'workload').map(event => {
      const parsed = museumAuditWorkloadSchema.safeParse(event.detail);
      return parsed.success ? parsed.data : { unavailable: true };
    });
    const workloadSignatures = [...new Set(workloads.map(workload => JSON.stringify(workload)))].sort();
    const renderer = raw.environment.renderer ?? raw.events.find(event => event.type === 'renderer-observed')?.detail.renderer ?? 'unavailable';
    const key = JSON.stringify({ ...raw.metadata, renderer, workloadSignatures });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(result);
  }
  const variation = values => {
    if (!values.length) return { min: null, max: null, mean: null, sampleStdDev: null, cv: null };
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const sampleStdDev = values.length >= 2 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)) : null;
    return { min: Math.min(...values), max: Math.max(...values), mean, sampleStdDev, cv: mean && sampleStdDev !== null ? sampleStdDev / mean : null };
  };
  console.log(JSON.stringify({
    interpretation: 'Render submissions, not presented FPS. Eligibility concerns capture validity only; physical-device and profiler evidence remain required. No CI FPS gate.',
    runs,
    groups: [...groups].map(([key, results]) => ({
      workload: JSON.parse(key), runCount: results.length, sufficientRepeats: results.filter(result => result.eligible).length >= 3,
      eligibleRunCount: results.filter(result => result.eligible).length,
      meanFps: variation(results.filter(result => result.eligible).map(result => result.frame.meanFps).filter(value => value !== null)),
      medianFps: variation(results.filter(result => result.eligible).map(result => result.frame.medianFps).filter(value => value !== null)),
      p95FrametimeMs: variation(results.filter(result => result.eligible).map(result => result.frame.p95Ms).filter(value => value !== null)),
    })),
  }, null, 2));
} catch (error) {
  console.error(`Invalid audit input: ${error instanceof Error ? error.message.slice(0, 2000) : 'unknown error'}`);
  process.exitCode = 1;
}
