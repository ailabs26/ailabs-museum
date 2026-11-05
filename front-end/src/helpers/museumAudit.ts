import { auditMetadataSchema, museumAuditRunSchema } from './museumAuditMetrics.ts';
import type { AuditMetadata, AuditResource, MuseumAuditRun } from './museumAuditMetrics.ts';

/** Numeric/JSON data only. The recorder never owns renderer, scene or DOM objects. */
export class MuseumAuditRecorder {
  private run: MuseumAuditRun | null = null;
  private limits: { frames: number; resources: number; events: number };

  constructor(limits = { frames: 120_000, resources: 1200, events: 4000 }) {
    this.limits = { frames: Math.min(120_000, limits.frames), resources: Math.min(1200, limits.resources), events: Math.min(4000, limits.events) };
  }

  get isRecording() { return this.run !== null && this.run.endedAt === null; }
  get startedAt() { return this.run?.startedAt ?? null; }

  start(metadata: AuditMetadata, at: number, wallTime: string, environment: MuseumAuditRun['environment'] = {}) {
    if (this.isRecording) throw new Error('Stop the current audit first.');
    this.run = museumAuditRunSchema.parse({ schemaVersion: 1, metadata: auditMetadataSchema.parse(metadata),
      wallTime, startedAt: at, endedAt: null, frames: [], resources: [], events: [], environment, droppedSamples: 0 });
  }

  frame(at: number, elapsedMs: number, rendererId: number) {
    if (!this.isRecording || !this.run) return;
    const previous = this.run.frames.at(-1)?.[0] ?? -Infinity;
    if (!Number.isFinite(at) || at < this.run.startedAt || at <= previous || !Number.isFinite(elapsedMs) || elapsedMs < 0
      || !Number.isInteger(rendererId) || rendererId < 0 || this.run.frames.length >= this.limits.frames) { this.run.droppedSamples++; return; }
    this.run.frames.push([at, elapsedMs, rendererId]);
  }

  event(at: number, type: string, detail: MuseumAuditRun['events'][number]['detail'] = {}) {
    if (!this.isRecording || !this.run || at < this.run.startedAt) return;
    if (this.run.events.length >= this.limits.events) { this.run.droppedSamples++; return; }
    this.run.events.push({ at, type, detail: { ...detail } });
  }

  resource(at: number, resource: Omit<AuditResource, 'at'>) {
    if (!this.isRecording || !this.run) return;
    if (this.run.resources.length >= this.limits.resources) { this.run.droppedSamples++; return; }
    this.run.resources.push({ at, ...resource });
  }

  stop(at: number): MuseumAuditRun {
    if (!this.run) throw new Error('No audit capture.');
    if (this.isRecording) this.run.endedAt = at;
    return museumAuditRunSchema.parse(this.run);
  }

  snapshot(): MuseumAuditRun | null { return this.run ? structuredClone(this.run) : null; }
  exportJson(): string {
    if (this.isRecording) throw new Error('Stop before exporting.');
    return JSON.stringify(museumAuditRunSchema.parse(this.run), null, 2);
  }
}
