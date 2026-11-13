import sharp from 'sharp';
import { AssetError, detectImage, LIMITS } from './validation.mjs';

const image = (bytes) => sharp(bytes, { limitInputPixels: LIMITS.pixels, failOn: 'warning', sequentialRead: true });

function pngAnimationFrames(bytes) {
  let offset = 8;
  let frames = 0;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new AssetError('INVALID_INPUT', 'Truncated PNG chunk header');
    const length = bytes.readUInt32BE(offset);
    const end = offset + length + 12;
    if (end > bytes.length) throw new AssetError('INVALID_INPUT', 'PNG chunk exceeds input bounds');
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (offset === 8 && (type !== 'IHDR' || length !== 13)) throw new AssetError('INVALID_INPUT', 'Invalid PNG chunk sequence');
    if (type === 'acTL') {
      if (length !== 8 || frames !== 0) throw new AssetError('INVALID_INPUT', 'Invalid PNG chunk animation control');
      frames = bytes.readUInt32BE(offset + 8);
      if (frames === 0) throw new AssetError('INVALID_INPUT', 'Invalid PNG chunk animation frame count');
    }
    if (type === 'IEND') {
      if (length !== 0 || end !== bytes.length) throw new AssetError('INVALID_INPUT', 'Invalid PNG chunk end');
      return frames;
    }
    offset = end;
  }
  throw new AssetError('INVALID_INPUT', 'PNG chunk end is missing');
}

export async function inspectImage(bytes) {
  const detected = detectImage(bytes);
  // libvips can expose APNG as a single PNG frame with no metadata.pages value.
  const animationFrames = detected === 'png' ? pngAnimationFrames(bytes) : 0;
  const metadata = await image(bytes).metadata();
  if (metadata.format !== detected || !metadata.width || !metadata.height || metadata.width * metadata.height > LIMITS.pixels) throw new AssetError('INVALID_INPUT', 'Image format or pixel limit exceeded');
  return { metadata, animatedPng: animationFrames > 0, metrics: { format: detected, width: metadata.width, height: metadata.height, hasAlpha: metadata.hasAlpha, orientation: metadata.orientation ?? 1, hasIcc: metadata.hasProfile ?? false, channels: metadata.channels, ...(animationFrames ? { animationFrames } : {}) } };
}

export async function webpCandidate(bytes, policy, { embedded = false } = {}) {
  const { metadata, metrics, animatedPng } = await inspectImage(bytes);
  if (animatedPng || (metadata.pages ?? 1) > 1 || metadata.icc || metadata.space === 'cmyk' || metadata.depth !== 'uchar') return { unsupported: 'Animated, ICC-profiled, CMYK or high-bit-depth images require manual color/metadata review', metrics };
  if (embedded && (metrics.format !== 'png' || metrics.orientation !== 1)) return { fallback: true, bytes, metrics, reason: 'Embedded conversion supports unprofiled 8-bit PNG only' };
  const lossless = embedded || policy !== 'photo' || metrics.hasAlpha || metrics.format !== 'jpeg';
  const candidate = await image(bytes).autoOrient().webp({ lossless, quality: 95, alphaQuality: 100, effort: 6, smartSubsample: true }).toBuffer();
  const expected = await image(bytes).autoOrient().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const decoded = await image(candidate).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (expected.info.width !== decoded.info.width || expected.info.height !== decoded.info.height) throw new AssetError('QUALITY_REJECTED', 'Image dimensions changed');
  const pixelExact = expected.data.equals(decoded.data);
  let squaredError = 0;
  let alphaExact = true;
  for (let index = 0; index < expected.data.length; index++) {
    const error = expected.data[index] - decoded.data[index];
    squaredError += error * error;
    if (index % 4 === 3 && error !== 0) alphaExact = false;
  }
  const mse = squaredError / expected.data.length;
  const psnr = mse === 0 ? null : 10 * Math.log10(255 ** 2 / mse);
  const reason = candidate.length >= bytes.length ? 'WebP candidate is not smaller' : lossless && !pixelExact ? 'Lossless decoded pixels differ' : !alphaExact ? 'Alpha changed' : !lossless && psnr < 38 ? 'Photo PSNR below conservative 38 dB candidate threshold' : null;
  if (reason) return { fallback: true, bytes, metrics, reason, quality: { pixelExact: true, alphaExact: true, visual: 'REVIEW_REQUIRED', candidateBytes: candidate.length, candidatePsnrDb: psnr } };
  return { bytes: candidate, metrics: { ...metrics, format: 'webp', width: decoded.info.width, height: decoded.info.height, orientation: 1 }, quality: { visual: 'REVIEW_REQUIRED', lossless, pixelExact, alphaExact, psnrDb: psnr, orientationApplied: metrics.orientation, iccPolicy: 'Unprofiled input only; original metadata retained in immutable source' } };
}
