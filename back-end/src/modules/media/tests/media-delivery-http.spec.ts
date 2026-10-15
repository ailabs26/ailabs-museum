import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { INestApplication, RequestMethod } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import { MEDIA_DELIVERY_ROUTE, MediaDeliveryController } from '../controllers/media-delivery.controller';
import { Media, MediaKind, MediaProcessingState } from '../entities/media.entity';
import { MediaRepository } from '../repositories/media.repository';
import { MediaDeliveryService } from '../services/media-delivery.service';
import { MEDIA_STORAGE_ROOTS, MediaStorageService } from '../services/media-storage.service';
import { MEDIA_URL_OPTIONS, MediaUrlService } from '../services/media-url.service';
import { buildGlb, buildVtt } from './media-test-files';
import { TEST_MEDIA_URL_OPTIONS } from './media-test-doubles';

/** Repo giả: media theo storage key + tập media "đang công khai". */
class FakeDeliveryRepo {
  rows = new Map<string, Media>();
  publicIds = new Set<string>();
  publicChecks = 0;
  async findDeliverableByKey(key: string): Promise<Media | null> {
    const media = this.rows.get(key);
    return media && !media.isDeleted && media.processingState === MediaProcessingState.READY ? media : null;
  }
  async isPubliclyReferenced(id: string): Promise<boolean> {
    this.publicChecks++;
    return this.publicIds.has(id);
  }
}

describe('MediaDeliveryController (HTTP thật, file thật)', () => {
  let app: INestApplication;
  let workDir: string;
  let publicRoot: string;
  const repo = new FakeDeliveryRepo();
  const urls = new MediaUrlService(TEST_MEDIA_URL_OPTIONS);
  const glb = buildGlb();
  const vtt = buildVtt();

  async function addFile(kind: MediaKind, data: Buffer, overrides: Partial<Media> = {}): Promise<Media> {
    const id = randomUUID();
    const [dir, ext, mime] = kind === MediaKind.MODEL ? ['models', 'glb', 'model/gltf-binary'] : ['subtitles', 'vtt', 'text/vtt'];
    const storageKey = `uploads/${dir}/${id}.${ext}`;
    await mkdir(join(publicRoot, 'uploads', dir), { recursive: true });
    await writeFile(join(publicRoot, storageKey), data);
    const media = Object.assign(new Media(), {
      id, kind, storageKey, mimeType: mime, sizeBytes: String(data.length),
      checksumSha256: createHash('sha256').update(data).digest('hex'),
      processingState: MediaProcessingState.READY, isDeleted: false, ...overrides,
    });
    repo.rows.set(storageKey, media);
    return media;
  }

  const path = (media: Media) => `/media/${media.storageKey}`;
  const http = () => request(app.getHttpServer());

  before(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'media-delivery-'));
    publicRoot = join(workDir, 'public');
    const moduleRef = await Test.createTestingModule({
      controllers: [MediaDeliveryController],
      providers: [
        MediaDeliveryService,
        MediaStorageService,
        { provide: MediaUrlService, useValue: urls },
        { provide: MEDIA_URL_OPTIONS, useValue: TEST_MEDIA_URL_OPTIONS },
        { provide: MEDIA_STORAGE_ROOTS, useValue: { publicRoot, quarantineRoot: join(workDir, 'q') } },
        { provide: MediaRepository, useValue: repo },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    // Giống main.ts: API dưới /api, riêng route media ở ngoài prefix.
    app.setGlobalPrefix('api', { exclude: [{ path: MEDIA_DELIVERY_ROUTE, method: RequestMethod.GET }] });
    app.enableCors({ origin: 'http://localhost:5173', credentials: true });
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  after(async () => {
    await app?.close();
    await rm(workDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    repo.publicIds.clear();
    repo.publicChecks = 0;
  });

  describe('media đang công khai', () => {
    it('200 + nội dung đúng + header an toàn', async () => {
      const media = await addFile(MediaKind.MODEL, glb);
      repo.publicIds.add(media.id);
      const res = await http().get(path(media)).buffer(true).parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      }).expect(200);
      assert.ok((res.body as Buffer).equals(glb));
      assert.equal(res.headers['content-type'], 'model/gltf-binary');
      assert.equal(res.headers['x-content-type-options'], 'nosniff');
      assert.equal(res.headers['content-security-policy'], "default-src 'none'; sandbox");
      assert.equal(res.headers['cache-control'], 'no-cache');
      assert.equal(res.headers['etag'], `"${media.checksumSha256}"`);
      assert.equal(res.headers['accept-ranges'], 'bytes');
      assert.equal(res.headers['content-disposition'], 'inline');
      assert.equal(res.headers['cross-origin-resource-policy'], 'cross-origin');
      assert.equal(res.headers['last-modified'], undefined);
    });

    it('WebVTT → text/vtt; charset=utf-8', async () => {
      const media = await addFile(MediaKind.SUBTITLE, vtt);
      repo.publicIds.add(media.id);
      const res = await http().get(path(media)).expect(200);
      assert.equal(res.headers['content-type'], 'text/vtt; charset=utf-8');
    });

    it('Range → 206 đúng đoạn byte', async () => {
      const media = await addFile(MediaKind.MODEL, glb);
      repo.publicIds.add(media.id);
      const res = await http().get(path(media)).set('Range', 'bytes=4-11').buffer(true).parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      }).expect(206);
      assert.ok((res.body as Buffer).equals(glb.subarray(4, 12)));
      assert.equal(res.headers['content-range'], `bytes 4-11/${glb.length}`);
    });

    it('Range ngoài kích thước file → 416', async () => {
      const media = await addFile(MediaKind.MODEL, glb);
      repo.publicIds.add(media.id);
      await http().get(path(media)).set('Range', `bytes=${glb.length + 10}-${glb.length + 20}`).expect(416);
    });

    it('If-None-Match khớp ETag → 304', async () => {
      const media = await addFile(MediaKind.MODEL, glb);
      repo.publicIds.add(media.id);
      await http().get(path(media)).set('If-None-Match', `"${media.checksumSha256}"`).expect(304);
    });

    it('HEAD → 200, có Content-Length, không body', async () => {
      const media = await addFile(MediaKind.MODEL, glb);
      repo.publicIds.add(media.id);
      const res = await http().head(path(media)).expect(200);
      assert.equal(res.headers['content-length'], String(glb.length));
    });

    it('CORS cho origin FE', async () => {
      const media = await addFile(MediaKind.MODEL, glb);
      repo.publicIds.add(media.id);
      const res = await http().get(path(media)).set('Origin', 'http://localhost:5173').expect(200);
      assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
    });
  });

  describe('từ chối → 404 thống nhất', () => {
    it('media chưa được revision public tham chiếu', async () => {
      const media = await addFile(MediaKind.MODEL, glb);
      const res = await http().get(path(media)).expect(404);
      assert.equal(res.body.success, false);
      assert.equal(res.headers['etag'] === `"${media.checksumSha256}"`, false);
    });

    it('media đã xóa mềm / chưa ready (kể cả khi từng công khai)', async () => {
      for (const overrides of [{ isDeleted: true }, { processingState: MediaProcessingState.FAILED }]) {
        const media = await addFile(MediaKind.MODEL, glb, overrides);
        repo.publicIds.add(media.id);
        await http().get(path(media)).expect(404);
      }
    });

    it('key không có trong DB', async () => {
      await http().get(`/media/uploads/models/${randomUUID()}.glb`).expect(404);
    });

    const badPaths = [
      '/media/uploads/models/not-a-uuid.glb',
      `/media/uploads/models/${randomUUID()}.exe`,
      `/media/uploads/models/${randomUUID().toUpperCase()}.glb`,
      `/media/uploads/secret/${randomUUID()}.glb`,
      `/media/uploads/models/..%2F..%2Fpackage.json`,
      `/media/uploads/models/%2e%2e`,
      `/media/uploads/models/${randomUUID()}.glb%00.png`,
      '/media/quarantine/x.bin',
    ];
    for (const bad of badPaths) {
      it(`đường dẫn không hợp lệ ${bad} → 404, không chạm DB`, async () => {
        const before = repo.publicChecks;
        await http().get(bad).expect(404);
        assert.equal(repo.publicChecks, before);
      });
    }

    it('file mất trên đĩa → 404 JSON, không lộ đường dẫn', async () => {
      const media = await addFile(MediaKind.MODEL, glb);
      repo.publicIds.add(media.id);
      await unlink(join(publicRoot, media.storageKey));
      const res = await http().get(path(media)).expect(404);
      assert.equal(JSON.stringify(res.body).includes(publicRoot), false);
      assert.equal(res.headers['etag'] === `"${media.checksumSha256}"`, false);
    });

    it('route không nằm dưới /api', async () => {
      const media = await addFile(MediaKind.MODEL, glb);
      repo.publicIds.add(media.id);
      await http().get(`/api${path(media)}`).expect(404);
    });
  });

  describe('URL đã ký (Preview)', () => {
    const signedPath = (media: Media, nowMs = Date.now()) => {
      const url = new URL(String(urls.signedUrl(media.storageKey, nowMs)));
      return url.pathname + url.search;
    };

    it('media chưa công khai + chữ ký hợp lệ → 200, Cache-Control private, no-store', async () => {
      const media = await addFile(MediaKind.MODEL, glb);
      const res = await http().get(signedPath(media)).expect(200);
      assert.equal(res.headers['cache-control'], 'private, no-store');
      assert.equal(repo.publicChecks, 0, 'đã có chữ ký thì không cần truy vấn công khai');
    });

    it('chữ ký hết hạn → 404', async () => {
      const media = await addFile(MediaKind.MODEL, glb);
      await http().get(signedPath(media, Date.now() - 3_600_000)).expect(404);
    });

    it('chữ ký của file khác → 404', async () => {
      const [a, b] = [await addFile(MediaKind.MODEL, glb), await addFile(MediaKind.MODEL, glb)];
      const query = new URL(String(urls.signedUrl(a.storageKey))).search;
      await http().get(`${path(b)}${query}`).expect(404);
    });

    it('chữ ký sai trên media đang công khai → 404 (không rơi về nhánh công khai)', async () => {
      const media = await addFile(MediaKind.MODEL, glb);
      repo.publicIds.add(media.id);
      await http().get(`${path(media)}?exp=9999999999&sig=${'a'.repeat(64)}`).expect(404);
      await http().get(`${path(media)}?sig=${'a'.repeat(64)}`).expect(404);
    });

    it('tham số lặp (exp mảng) → 404, không 500', async () => {
      const media = await addFile(MediaKind.MODEL, glb);
      await http().get(`${path(media)}?exp=1&exp=2&sig=${'a'.repeat(64)}`).expect(404);
    });
  });
});
