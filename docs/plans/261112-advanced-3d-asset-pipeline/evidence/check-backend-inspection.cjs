// Run from back-end with -r reflect-metadata -r ts-node/register, followed by generated manifest paths.
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const { MediaInspectionService } = require(resolve('src/modules/media/services/media-inspection.service.ts'));

assert.ok(process.argv.length > 2, 'Provide generated manifest paths');
const inspection = new MediaInspectionService();
const records = process.argv.slice(2).flatMap(manifestPath => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  return manifest.artifacts.map(artifact => {
    assert.match(artifact.file, /^(?:lod[0-2]\.glb|image\.webp)$/);
    const bytes = readFileSync(resolve(dirname(manifestPath), artifact.file));
    assert.equal(bytes.length, artifact.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), artifact.sha256);
    const spec = inspection.identify(bytes);
    assert.ok(bytes.length <= spec.maxBytes);
    inspection.validateStructure(spec, bytes);
    return { file: artifact.file, format: spec.format, mimeType: spec.mimeType, bytes: bytes.length,
      uploadMaxBytes: spec.maxBytes, checksumSha256: artifact.sha256, inspection: 'ACCEPTED' };
  });
});
process.stdout.write(`${JSON.stringify({ scope: 'Existing backend byte identification, upload limits and structure validation. Read-only generated candidates.', records }, null, 2)}\n`);
