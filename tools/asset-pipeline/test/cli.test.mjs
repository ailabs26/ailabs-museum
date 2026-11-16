import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFixture } from './fixture.mjs';

const run = promisify(execFile);
const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
const temporaryRoot = fileURLToPath(new URL('../.tmp/', import.meta.url));
await mkdir(temporaryRoot, { recursive: true });

test('CLI help, invalid options and real invocation use the normal entry point', async () => {
  assert.match((await run(process.execPath, [cli, '--help'])).stdout, /--source/);
  await assert.rejects(run(process.execPath, [cli]), (error) => error.code === 1 && /--source/.test(error.stderr));
  await assert.rejects(run(process.execPath, [cli, '--unknown']), (error) => error.code === 1);
  const directory = await mkdtemp(join(temporaryRoot, 'aura-cli-'));
  try {
    const source = join(directory, 'original.glb');
    await createFixture(source, 8);
    const output = join(directory, 'candidate');
    const { stdout } = await run(process.execPath, [cli, '--source', source, '--output', output]);
    assert.equal(JSON.parse(stdout).status, 'REVIEW_REQUIRED');
    assert.equal(JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8')).publicationEligible, false);
    const config = join(directory, 'config.json');
    await writeFile(config, JSON.stringify({ source: source }));
    await assert.rejects(run(process.execPath, [cli, '--source', source, '--output', join(directory, 'bad'), '--config', config]), (error) => /Unknown config/.test(error.stderr));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
