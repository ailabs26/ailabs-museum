// Đo bundle Hermes theo nền tảng và so với ngân sách (MOB-E11-03). Chạy: npm run perf:bundle
// Luôn tách sourcemap: không tách thì Hermes giữ debug info, file lớn hơn ~65% và không so sánh được.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const budget = JSON.parse(readFileSync(new URL('./bundle-budget.json', import.meta.url), 'utf8'));
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
let over = false;

for (const [platform, limit] of Object.entries(budget)) {
  const dir = mkdtempSync(join(tmpdir(), 'aura-bundle-'));
  try {
    execFileSync('npx', ['expo', 'export', '--platform', platform, '--dump-sourcemap', '--output-dir', dir], {
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    const bytes = readdirSync(dir, { recursive: true })
      .filter((file) => file.endsWith('.hbc'))
      .reduce((sum, file) => sum + statSync(join(dir, file)).size, 0);
    if (bytes === 0) throw new Error(`Không thấy bundle Hermes của ${platform}`);
    const ok = bytes <= limit;
    over ||= !ok;
    console.log(`${ok ? 'OK  ' : 'VƯỢT'} ${platform}: ${mb(bytes)} / ${mb(limit)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
process.exit(over ? 1 : 0);
