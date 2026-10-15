import 'reflect-metadata';
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createServer } from 'node:http';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ModelStorageService } from '../../media/services/model-storage.service';
import { toPublicModel } from '../../media/dto/public-model.dto';
import { Media, MediaKind, MediaProcessingState } from '../../media/entities/media.entity';
import { PublicModelsService } from '../services/public-models.service';
import { ExhibitsService } from '../services/exhibits.service';

const media = Object.assign(new Media(), {
  id: 'a1111111-1111-4111-8111-111111111111', kind: MediaKind.MODEL,
  storageKey: 'models/example.glb', processingState: MediaProcessingState.READY,
  sizeBytes: '120', checksumSha256: 'a'.repeat(64), isDeleted: false,
});

it('only publishes ready undeleted GLB media with safe stable keys', () => {
  const model = toPublicModel(media, 'room', 'exhibit');
  assert.ok(model);
  assert.match(model.url, /^\/rooms\/room\/exhibits\/exhibit\/model\?version=/);
  assert.equal(model.storageKey, 'models/example.glb');
  for (const patch of [{ isDeleted: true }, { processingState: MediaProcessingState.FAILED },
    { storageKey: '../secret.glb' }, { storageKey: 'https://evil/a.glb' },
    { storageKey: 'models/%2e%2e/a.glb' }, { sizeBytes: '999999999999' }, { kind: MediaKind.IMAGE }]) {
    assert.equal(toPublicModel({ ...media, ...patch }, 'room', 'exhibit'), null);
  }
});

it('rechecks published room metadata before giving a private model to storage', async () => {
  let downloads = 0;
  const descriptor = toPublicModel(media, 'room', 'exhibit')!;
  const content = { roomWithExhibits: async () => ({ exhibits: [{ id: 'exhibit', model: descriptor }] }) };
  const storage = { open: async () => { downloads++; return 'stream'; } };
  const service = new PublicModelsService(content as unknown as ExhibitsService, storage as unknown as ModelStorageService);
  await assert.rejects(() => service.open('room', 'hidden', undefined), NotFoundException);
  await assert.rejects(() => service.open('room', 'exhibit', 'old-checksum'), NotFoundException);
  assert.equal(downloads, 0);
  await service.open('room', 'exhibit', media.checksumSha256);
  assert.equal(downloads, 1);
});

it('signs private objects server-side and streams bytes without exposing credentials', async () => {
  const server = createServer((request, response) => {
    assert.equal(request.headers.apikey, 'test-server-key');
    if (request.method === 'POST') {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ signedURL: '/object/sign/assets/models/example.glb?token=test' }));
    } else {
      response.setHeader('Content-Length', '4');
      response.end('glTF');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const storage = new ModelStorageService(new ConfigService({
      SUPABASE_URL: `http://127.0.0.1:${address.port}`, SUPABASE_SECRET_KEY: 'test-server-key', SUPABASE_STORAGE_BUCKET: 'assets',
    }));
    const result = await storage.open('models/example.glb', 4);
    const chunks: Buffer[] = [];
    for await (const chunk of result.stream) chunks.push(Buffer.from(chunk as Uint8Array));
    assert.equal(Buffer.concat(chunks).toString(), 'glTF');
  } finally { server.closeAllConnections(); server.close(); }
});

it('fails closed when Storage is unconfigured or a key is unsafe', async () => {
  const storage = new ModelStorageService(new ConfigService());
  await assert.rejects(() => storage.open('../secret.glb', 4), NotFoundException);
  await assert.rejects(() => storage.open('models/example.glb', 4), ServiceUnavailableException);
});
