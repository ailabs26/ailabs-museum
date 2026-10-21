import 'reflect-metadata';
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createServer } from 'node:http';
import { ConfigService } from '@nestjs/config';
import { BadGatewayException, CallHandler, ExecutionContext, NotFoundException, ServiceUnavailableException, StreamableFile } from '@nestjs/common';
import { Readable } from 'node:stream';
import { firstValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { RoomStatus } from '../../rooms/entities/room.entity';
import { RoomsRepository } from '../../rooms/repositories/rooms.repository';
import { ExhibitsRepository } from '../repositories/exhibits.repository';
import { RevisionState } from '../entities/exhibit-revision.entity';
import { ModelStorageService } from '../../media/services/model-storage.service';
import { toPublicModel } from '../../media/dto/public-model.dto';
import { Media, MediaKind, MediaProcessingState } from '../../media/entities/media.entity';
import { PublicModelsService } from '../services/public-models.service';
import { ExhibitsService } from '../services/exhibits.service';
import { RevisionPublishGate } from '../services/revision-publish.gate';
import { MediaReferenceValidator } from '../../media/services/media-reference.validator';
import { MediaUrlService } from '../../media/services/media-url.service';

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

it('creates a fresh signed request on retry after an expired Storage authorization', async () => {
  let signatures = 0;
  const server = createServer((request, response) => {
    if (request.method === 'POST') {
      signatures++;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ signedURL: `/object/sign/assets/models/example.glb?attempt=${signatures}` }));
    } else if (request.url?.endsWith('attempt=1')) {
      response.statusCode = 403; response.end('Controlled expired authorization');
    } else {
      response.setHeader('Content-Length', '4'); response.end('glTF');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  try {
    const storage = new ModelStorageService(new ConfigService({
      SUPABASE_URL: `http://127.0.0.1:${address.port}`, SUPABASE_SECRET_KEY: 'test-server-key', SUPABASE_STORAGE_BUCKET: 'assets',
    }));
    await assert.rejects(() => storage.open('models/example.glb', 4), BadGatewayException);
    const result = await storage.open('models/example.glb', 4);
    const chunks: Buffer[] = [];
    for await (const chunk of result.stream) chunks.push(Buffer.from(chunk as Uint8Array));
    assert.equal(Buffer.concat(chunks).toString(), 'glTF'); assert.equal(signatures, 2);
  } finally { server.closeAllConnections(); server.close(); }
});

it('fails closed when Storage is unconfigured or a key is unsafe', async () => {
  const storage = new ModelStorageService(new ConfigService());
  await assert.rejects(() => storage.open('../secret.glb', 4), NotFoundException);
  await assert.rejects(() => storage.open('models/example.glb', 4), ServiceUnavailableException);
});

it('passes binary models through the response interceptor while preserving JSON envelopes', async () => {
  const file = new StreamableFile(Readable.from('glTF'));
  const interceptor = new ResponseInterceptor();
  const context = {} as ExecutionContext;
  assert.equal(await firstValueFrom(interceptor.intercept(context, { handle: () => of(file) } as CallHandler)), file);
  assert.deepEqual(await firstValueFrom(interceptor.intercept(context, { handle: () => of({ id: 'room' }) } as CallHandler)),
    { success: true, data: { id: 'room' }, message: null });
});

it('rejects archived rooms and unapproved revisions using the actual publication service', async () => {
  const room = { id: 'room', slug: 'room', name: 'Room', description: '', status: RoomStatus.ACTIVE, isDeleted: false };
  const revision = { id: 'revision', state: RevisionState.APPROVED, content: { name: 'Artifact', description: '' }, modelMedia: media, hotspots: [] };
  const publication = new ExhibitsService(
    { findByRoom: async () => [{ id: 'exhibit', roomId: 'room', displayOrder: 0, publishedRevisionId: 'revision', publishedRevision: revision }] } as unknown as ExhibitsRepository,
    { findBySlug: async () => room } as unknown as RoomsRepository, {} as TransactionManager,
    {} as MediaReferenceValidator, {} as RevisionPublishGate, { publicUrl: () => null } as unknown as MediaUrlService);
  const content = await publication.roomWithExhibits('room');
  assert.ok(content.exhibits[0].model);
  assert.equal(content.exhibits[0].positionX, undefined, 'absent placement must reach the room layout fallback');
  const service = new PublicModelsService(publication, { open: async () => { throw new Error('Storage must not be called'); } } as unknown as ModelStorageService);
  room.status = RoomStatus.ARCHIVED;
  await assert.rejects(() => service.open('room', 'exhibit'), NotFoundException);
  room.status = RoomStatus.ACTIVE;
  for (const state of [RevisionState.DRAFT, RevisionState.IN_REVIEW, RevisionState.REJECTED]) {
    revision.state = state;
    await assert.rejects(() => service.open('room', 'exhibit'), NotFoundException);
  }
});

it('redacts permission/not-found errors and rejects unexpected signed download paths', async () => {
  let status = 403;
  const server = createServer((_request, response) => {
    response.statusCode = status;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(status === 200 ? { signedURL: '/object/sign/other-bucket/secret.glb?token=private' } : { message: 'private-upstream-details' }));
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const storage = new ModelStorageService(new ConfigService({ SUPABASE_URL: `http://127.0.0.1:${address.port}`,
    SUPABASE_SECRET_KEY: 'test-server-key', SUPABASE_STORAGE_BUCKET: 'assets' }));
  try {
    for (status of [403, 404, 500, 200]) {
      await assert.rejects(() => storage.open('models/example.glb', 4), error => error instanceof BadGatewayException && !error.message.includes('private'));
    }
  } finally { server.closeAllConnections(); server.close(); }
});
