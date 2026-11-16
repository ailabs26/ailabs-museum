import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createFixture } from './fixture.mjs';

const output = resolve(process.argv[2] ?? 'evidence/synthetic');
await mkdir(dirname(output), { recursive: true });
await mkdir(output);
await createFixture(join(output, 'original.glb'));
process.stdout.write(`${join(output, 'original.glb')}\n`);
