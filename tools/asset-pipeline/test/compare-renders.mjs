import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';

const input = resolve(process.argv[2] ?? '');
const output = process.argv[3] && resolve(process.argv[3]);
if (!process.argv[2] || !output) throw new Error('Usage: node test/compare-renders.mjs <screenshot-directory> <fresh-output-directory>');

const names = ['original', 'lod0', 'lod1', 'lod2'];
const renders = await Promise.all(names.map(name => sharp(join(input, `${name}-fixed-camera.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
const { width, height } = renders[0].info;
if (renders.some(render => render.info.width !== width || render.info.height !== height)) throw new Error('Render dimensions differ');

const metrics = renders.slice(1).map((render, index) => {
  let squaredError = 0;
  let absoluteError = 0;
  let maxError = 0;
  let changed = 0;
  for (let pixel = 0; pixel < width * height; pixel++) {
    let pixelChanged = false;
    for (let channel = 0; channel < 3; channel++) {
      const difference = Math.abs(render.data[pixel * 4 + channel] - renders[0].data[pixel * 4 + channel]);
      squaredError += difference * difference;
      absoluteError += difference;
      maxError = Math.max(maxError, difference);
      pixelChanged ||= difference > 0;
    }
    if (pixelChanged) changed++;
  }
  const mse = squaredError / (width * height * 3);
  return { candidate: names[index + 1], mse, psnrDb: mse === 0 ? null : 10 * Math.log10(255 ** 2 / mse),
    meanAbsoluteError: absoluteError / (width * height * 3), maxChannelError: maxError,
    changedPixelFraction: changed / (width * height) };
});

await mkdir(output);
const header = 32;
const composite = renders.flatMap((render, index) => {
  const left = (index % 2) * width;
  const top = Math.floor(index / 2) * (height + header);
  const label = Buffer.from(`<svg width="${width}" height="${header}"><text x="12" y="23" font-family="sans-serif" font-size="18" fill="#222">${names[index]}</text></svg>`);
  return [{ input: label, left, top }, { input: render.data, raw: { width, height, channels: 4 }, left, top: top + header }];
});
await sharp({ create: { width: width * 2, height: (height + header) * 2, channels: 4, background: '#eee9df' } })
  .composite(composite).png().toFile(join(output, 'contact-sheet.png'));
await writeFile(join(output, 'render-comparison.json'), `${JSON.stringify({ width, height, metrics,
  method: 'Full-frame RGB errors at identical camera, lighting and resolution. Background contributes to aggregate scores.',
  visualQa: 'REVIEW_REQUIRED', limitations: 'Single synthetic front view. Curator review of silhouettes, inscriptions, materials and approved LOD viewing distances is required.' }, null, 2)}\n`);
