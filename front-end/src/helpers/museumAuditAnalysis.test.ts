import { expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execPath } from 'node:process';
import { MuseumAuditRecorder } from './museumAudit';

it('re-analyzes exported raw JSON and separates workloads rather than pooling device FPS', () => {
  const folder = mkdtempSync(join(tmpdir(), 'museum-audit-analysis-'));
  const files = [join(folder, 'one.json'), join(folder, 'two.json'), join(folder, 'other-device.json'), join(folder, 'short.json')];
  try {
    for (let i = 0; i < 4; i++) {
      const recorder = new MuseumAuditRecorder();
      recorder.start({ buildSha: 'a'.repeat(40), device: i === 2 ? 'another device' : 'logic fixture', conditions: 'unit test', scenario: 'P03', kind: 'continuous', source: 'fixture', target: 'desktop' }, 0, '2026-11-04T00:00:00Z');
      recorder.event(0, 'workload', { roomId: 'fixture', exhibits: 5, visibleExhibits: 5, tier: 'balanced', dprCap: 1.5, shadowSize: 1024, anisotropy: 4,
        viewportWidth: 1280, viewportHeight: 720, renderWidth: 1280, renderHeight: 720, devicePixelRatio: 1,
        expectedGlbAssets: 0, readyGlbAssets: 0, failedGlbAssets: 0, failedGlbRenders: 0, xrPresenting: false });
      const interval = i === 1 ? 20 : i === 3 ? 8 : 16;
      for (let frame = 0; frame <= 2000; frame++) recorder.frame(frame * interval, 1, 1);
      recorder.stop(interval * 2000);
      writeFileSync(files[i], recorder.exportJson());
    }
    const result = JSON.parse(execFileSync(execPath, ['scripts/analyze-museum-audit.mjs', ...files], { encoding: 'utf8' }));
    expect(result.runs).toHaveLength(4);
    expect(result.runs[0].frame.meanFps).toBe(62.5);
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].runCount).toBe(3);
    expect(result.groups[0].eligibleRunCount).toBe(2);
    expect(result.groups[0].meanFps).toMatchObject({ min: 50, max: 62.5, mean: 56.25 });
    expect(result.groups[0].sufficientRepeats).toBe(false);
    writeFileSync(files[0], '{"schemaVersion":99}');
    const invalid = spawnSync(execPath, ['scripts/analyze-museum-audit.mjs', files[0]], { encoding: 'utf8' });
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain('Invalid audit input');
  } finally {
    for (const file of files) unlinkSync(file);
    rmdirSync(folder);
  }
});
