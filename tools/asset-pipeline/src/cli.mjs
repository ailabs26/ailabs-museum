import { parseArgs } from 'node:util';
import { readFile, stat } from 'node:fs/promises';
import { optimizeAsset } from './optimizer.mjs';

const usage = 'npm run optimize -- --source <master.glb|image> --output <fresh-directory> [--config <model.json>] [--image-policy detail|data|photo] [--embedded-webp]';

try {
  const { values } = parseArgs({ options: { source: { type: 'string' }, output: { type: 'string' }, config: { type: 'string' }, 'image-policy': { type: 'string' }, 'embedded-webp': { type: 'boolean' }, help: { type: 'boolean', short: 'h' } }, strict: true, allowPositionals: false });
  if (values.help) {
    process.stdout.write(`${usage}\nAll candidates require human visual review.\n`);
  } else {
    if (!values.source || !values.output) throw new Error(usage);
    let config = {};
    if (values.config) {
      const info = await stat(values.config);
      if (!info.isFile() || info.size > 64 * 1024) throw new Error('Config must be a JSON file within 64 KiB');
      config = JSON.parse(await readFile(values.config, 'utf8'));
      if (!config || Array.isArray(config) || typeof config !== 'object' || Object.keys(config).some((key) => !['lod', 'boundsTolerance', 'surfaceTolerance', 'embeddedWebp', 'imagePolicy'].includes(key))) throw new Error('Unknown config fields');
    }
    if (values['image-policy']) config.imagePolicy = values['image-policy'];
    if (values['embedded-webp']) config.embeddedWebp = true;
    const result = await optimizeAsset({ ...config, source: values.source, output: values.output });
    process.stdout.write(`${JSON.stringify({ status: result.status, publicationEligible: result.publicationEligible, source: result.source, artifacts: result.artifacts.map(({ file, bytes, sha256, lod }) => ({ file, bytes, sha256, lod })), unsupported: result.unsupported }, null, 2)}\n`);
    if (result.status === 'UNSUPPORTED') process.exitCode = 2;
  }
} catch (error) {
  process.stderr.write(`${error.code ?? 'PROCESSING_FAILED'} ${error.message}\n`);
  process.exitCode = 1;
}
