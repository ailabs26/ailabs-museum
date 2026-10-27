import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { ListMediaQueryDto } from '../dto/list-media-query.dto';
import { UploadMediaDto } from '../dto/upload-media.dto';
import { MediaKind, MediaProcessingState } from '../entities/media.entity';
import { MediaErrorCode, MediaFormatError } from '../inspection/media-format.error';
import { MediaRepository } from '../repositories/media.repository';
import { MediaService, UploadedMediaFile, sanitizeOriginalName } from '../services/media.service';
import {
  EXE_FILE,
  SVG_FILE,
  buildGlb,
  buildGlbOfSize,
  buildJpeg,
  buildMp3,
  buildMp3OfAtLeast,
  buildPng,
  buildPngOfSize,
  buildVtt,
  buildWebp,
} from './media-test-files';
import {
  ControllableInspection,
  FAKE_MANAGER,
  FailingStorage,
  FakeMediaRepository,
  FakeTransactionManager,
  signedUrlPattern,
  testMediaUrlService,
} from './media-test-doubles';

// ------------------------------------------------------------------ helpers

const ACTOR_ID = 'a0000000-0000-4000-8000-000000000001';

function file(buffer: Buffer, originalname = 'upload.bin'): UploadedMediaFile {
  return { buffer, originalname };
}

function dto(values: Partial<UploadMediaDto> = {}): UploadMediaDto {
  return Object.assign(new UploadMediaDto(), values);
}

async function expectHttpError(
  promise: Promise<unknown>,
  type: new (...args: never[]) => HttpException,
  code?: MediaErrorCode,
  messagePattern?: RegExp,
): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof type, `kỳ vọng ${type.name}, nhận ${String(error)}`);
    const body = error.getResponse() as { message?: string; errors?: Array<{ code: string; field?: string }> };
    if (code) {
      assert.equal(body.errors?.[0]?.code, code);
      assert.equal(body.errors?.[0]?.field, 'file');
    }
    if (messagePattern) assert.match(String(body.message), messagePattern);
    return true;
  });
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

// ------------------------------------------------------------------ suite

describe('MediaService', () => {
  let workDir: string;
  let publicRoot: string;
  let quarantineRoot: string;
  let repo: FakeMediaRepository;
  let storage: FailingStorage;
  let inspection: ControllableInspection;
  let tx: FakeTransactionManager;
  let service: MediaService;

  before(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'media-service-'));
  });

  after(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    const runId = randomUUID();
    publicRoot = join(workDir, runId, 'public');
    quarantineRoot = join(workDir, runId, 'quarantine');
    repo = new FakeMediaRepository();
    storage = new FailingStorage({ publicRoot, quarantineRoot });
    inspection = new ControllableInspection();
    tx = new FakeTransactionManager();
    service = new MediaService(
      repo as unknown as MediaRepository,
      storage,
      inspection,
      tx as unknown as TransactionManager,
      testMediaUrlService(),
    );
  });

  // ---------------------------------------------------------------- upload hợp lệ
  describe('upload — file hợp lệ → READY', () => {
    const cases: Array<[string, () => Buffer, MediaKind, string, RegExp]> = [
      ['GLB', () => buildGlb(), MediaKind.MODEL, 'model/gltf-binary', signedUrlPattern('models', 'glb')],
      ['PNG', () => buildPng(), MediaKind.IMAGE, 'image/png', signedUrlPattern('images', 'png')],
      ['JPEG', () => buildJpeg(), MediaKind.IMAGE, 'image/jpeg', signedUrlPattern('images', 'jpg')],
      ['WebP', () => buildWebp(), MediaKind.IMAGE, 'image/webp', signedUrlPattern('images', 'webp')],
      ['MP3', () => buildMp3({ withId3: true }), MediaKind.AUDIO, 'audio/mpeg', signedUrlPattern('audio', 'mp3')],
      ['WebVTT', () => buildVtt(), MediaKind.SUBTITLE, 'text/vtt', signedUrlPattern('subtitles', 'vtt')],
    ];
    for (const [label, build, kind, mime, urlPattern] of cases) {
      it(`${label}: kind=${kind}, mime=${mime}, file lưu đúng nội dung`, async () => {
        const buffer = build();
        const result = await service.upload(file(buffer, `sample.${label.toLowerCase()}`), dto(), ACTOR_ID);
        assert.equal(result.kind, kind);
        assert.equal(result.mimeType, mime);
        assert.equal(result.processingState, MediaProcessingState.READY);
        assert.match(String(result.url), urlPattern);
        assert.equal(result.sizeBytes, buffer.length);
        assert.equal(result.checksumSha256, createHash('sha256').update(buffer).digest('hex'));
        const stored = await readFile(join(publicRoot, repo.only().storageKey));
        assert.ok(stored.equals(buffer));
      });
    }

    it('MIME/đuôi file do client khai báo bị bỏ qua: PNG tên "virus.exe" vẫn lưu là image/png, .png', async () => {
      const result = await service.upload({ buffer: buildPng(), originalname: 'virus.exe' }, dto(), ACTOR_ID);
      assert.equal(result.mimeType, 'image/png');
      assert.match(repo.only().storageKey, /\.png$/);
      assert.equal(result.originalName, 'virus.exe');
    });

    it('lưu metadata quyền sử dụng (FR-97) và altText', async () => {
      const result = await service.upload(
        file(buildPng()),
        dto({ source: 'Bảo tàng LSQS', author: 'Nguyễn Văn A', license: 'CC BY 4.0', altText: 'Trống đồng' }),
        ACTOR_ID,
      );
      assert.equal(result.source, 'Bảo tàng LSQS');
      assert.equal(result.author, 'Nguyễn Văn A');
      assert.equal(result.license, 'CC BY 4.0');
      assert.equal(result.altText, 'Trống đồng');
    });

    it('metadata không gửi → null', async () => {
      const result = await service.upload(file(buildPng()), dto(), ACTOR_ID);
      assert.equal(result.source, null);
      assert.equal(result.author, null);
      assert.equal(result.license, null);
      assert.equal(result.altText, null);
    });

    it('ghi nhận người upload (createdById)', async () => {
      assert.equal((await service.upload(file(buildPng()), dto(), ACTOR_ID)).createdById, ACTOR_ID);
    });

    it('không có người dùng (actorId null) vẫn tạo được bản ghi', async () => {
      assert.equal((await service.upload(file(buildPng()), dto(), null)).createdById, null);
    });

    it('kind khớp nội dung → chấp nhận', async () => {
      assert.equal((await service.upload(file(buildGlb()), dto({ kind: MediaKind.MODEL }), ACTOR_ID)).kind, MediaKind.MODEL);
    });

    it('hai lần upload cùng nội dung → hai bản ghi, hai file riêng (không ghi đè)', async () => {
      const first = await service.upload(file(buildPng()), dto(), ACTOR_ID);
      const second = await service.upload(file(buildPng()), dto(), ACTOR_ID);
      assert.notEqual(first.id, second.id);
      assert.notEqual(first.url, second.url);
      assert.equal(listFiles(publicRoot).length, 2);
    });
  });

  // ---------------------------------------------------------------- giới hạn dung lượng
  describe('upload — giới hạn dung lượng (413)', () => {
    it('PNG đúng 2.000.000 byte → chấp nhận (biên trên)', async () => {
      const png = buildPngOfSize(2_000_000);
      assert.equal(png.length, 2_000_000);
      assert.equal((await service.upload(file(png), dto(), ACTOR_ID)).sizeBytes, 2_000_000);
    });

    it('PNG 2.000.001 byte → 413', async () => {
      await expectHttpError(service.upload(file(buildPngOfSize(2_000_001)), dto(), ACTOR_ID), PayloadTooLargeException, MediaErrorCode.TOO_LARGE, /2 MB/);
      assert.equal(repo.rows.size, 0);
      assert.deepEqual(listFiles(publicRoot), []);
    });

    it('GLB đúng 10.000.000 byte → chấp nhận', async () => {
      const glb = buildGlbOfSize(10_000_000);
      assert.equal(glb.length, 10_000_000);
      assert.equal((await service.upload(file(glb), dto(), ACTOR_ID)).sizeBytes, 10_000_000);
    });

    it('GLB 10.000.004 byte → 413', async () => {
      await expectHttpError(service.upload(file(buildGlbOfSize(10_000_004)), dto(), ACTOR_ID), PayloadTooLargeException, MediaErrorCode.TOO_LARGE, /10 MB/);
      assert.equal(repo.rows.size, 0);
    });

    it('MP3 > 10 MB → 413', async () => {
      await expectHttpError(service.upload(file(buildMp3OfAtLeast(10_000_001)), dto(), ACTOR_ID), PayloadTooLargeException, MediaErrorCode.TOO_LARGE);
    });

    it('MP3 9,9 MB → chấp nhận', async () => {
      const mp3 = buildMp3OfAtLeast(9_900_000);
      assert.ok(mp3.length < 10_000_000);
      assert.equal((await service.upload(file(mp3), dto(), ACTOR_ID)).kind, MediaKind.AUDIO);
    });

    it('WebVTT > 1 MB → 413', async () => {
      const big = buildVtt(`WEBVTT\n\n00:00.000 --> 00:01.000\n${'a'.repeat(1_000_001)}\n`);
      await expectHttpError(service.upload(file(big), dto(), ACTOR_ID), PayloadTooLargeException, MediaErrorCode.TOO_LARGE, /1 MB/);
    });

    it('JPEG > 2 MB → 413 (giới hạn theo định dạng thực tế, không theo khai báo)', async () => {
      const jpeg = buildJpeg({ trailing: Buffer.alloc(2_000_001) });
      await expectHttpError(service.upload(file(jpeg, 'small.glb'), dto(), ACTOR_ID), PayloadTooLargeException, MediaErrorCode.TOO_LARGE);
    });

    it('vượt dung lượng được báo TRƯỚC khi parse: PNG hỏng 3 MB → 413 chứ không phải 422', async () => {
      const brokenBig = Buffer.concat([buildPng().subarray(0, 8), Buffer.alloc(3_000_000)]);
      await expectHttpError(service.upload(file(brokenBig), dto(), ACTOR_ID), PayloadTooLargeException);
    });
  });

  // ---------------------------------------------------------------- từ chối 4xx
  describe('upload — file bị từ chối không được lưu', () => {
    async function expectRejected(buffer: Buffer, code: MediaErrorCode, values: Partial<UploadMediaDto> = {}, name = 'x.bin') {
      await expectHttpError(service.upload(file(buffer, name), dto(values), ACTOR_ID), UnprocessableEntityException, code);
      assert.equal(repo.rows.size, 0, 'không được tạo bản ghi');
      assert.deepEqual(listFiles(publicRoot), [], 'không được lưu file public');
      assert.deepEqual(listFiles(quarantineRoot), [], 'không được lưu file quarantine');
    }

    it('thiếu file → 400 media_file_required', async () => {
      await expectHttpError(service.upload(undefined, dto(), ACTOR_ID), BadRequestException, MediaErrorCode.FILE_REQUIRED);
    });

    it('file không có buffer → 400', async () => {
      await expectHttpError(service.upload({ buffer: 'abc' as unknown as Buffer }, dto(), ACTOR_ID), BadRequestException, MediaErrorCode.FILE_REQUIRED);
    });

    it('file rỗng → 422 media_empty_file', () => expectRejected(Buffer.alloc(0), MediaErrorCode.EMPTY_FILE));
    it('.exe đổi tên thành .glb → 422 media_unsupported_type', () => expectRejected(EXE_FILE, MediaErrorCode.UNSUPPORTED_TYPE, {}, 'model.glb'));
    it('.exe khai báo kind=model → 422 media_unsupported_type', () => expectRejected(EXE_FILE, MediaErrorCode.UNSUPPORTED_TYPE, { kind: MediaKind.MODEL }));
    it('SVG → 422 media_markup_rejected', () => expectRejected(SVG_FILE, MediaErrorCode.MARKUP_REJECTED, {}, 'icon.svg'));
    it('SVG đổi tên thành .png và kind=image → vẫn 422 media_markup_rejected', () =>
      expectRejected(SVG_FILE, MediaErrorCode.MARKUP_REJECTED, { kind: MediaKind.IMAGE }, 'photo.png'));
    it('HTML → 422 media_markup_rejected', () => expectRejected(Buffer.from('<html><script>alert(1)</script></html>'), MediaErrorCode.MARKUP_REJECTED));
    it('PHP → 422 media_markup_rejected', () => expectRejected(Buffer.from('<?php system($_GET[1]); ?>'), MediaErrorCode.MARKUP_REJECTED, {}, 'shell.php.png'));
    it('JavaScript → 422 media_unsupported_type', () => expectRejected(Buffer.from('fetch("/api").then(r => r)'), MediaErrorCode.UNSUPPORTED_TYPE, {}, 'app.js'));
    it('GIF → 422 media_unsupported_type', () => expectRejected(Buffer.from('GIF89a\x01\x00\x01\x00', 'latin1'), MediaErrorCode.UNSUPPORTED_TYPE));
    it('PNG nhưng chọn kind=model → 422 media_kind_mismatch', () => expectRejected(buildPng(), MediaErrorCode.KIND_MISMATCH, { kind: MediaKind.MODEL }));
    it('MP3 nhưng chọn kind=subtitle → 422 media_kind_mismatch', () => expectRejected(buildMp3(), MediaErrorCode.KIND_MISMATCH, { kind: MediaKind.SUBTITLE }));
    it('GLB hỏng (magic đúng, JSON lỗi) → 422 media_corrupted', () =>
      expectRejected(buildGlb({ json: '{"asset":', bin: null }), MediaErrorCode.CORRUPTED, {}, 'model.glb'));
    it('GLB tham chiếu texture ngoài → 422 media_external_resource', () =>
      expectRejected(buildGlb({ json: { asset: { version: '2.0' }, images: [{ uri: 'tex.png' }] }, bin: null }), MediaErrorCode.EXTERNAL_RESOURCE));
    it('PNG bị cắt cụt → 422 media_corrupted', () => expectRejected(buildPng().subarray(0, 40), MediaErrorCode.CORRUPTED));
    it('JPEG thiếu EOI → 422 media_corrupted', () => expectRejected(buildJpeg({ omitEoi: true }), MediaErrorCode.CORRUPTED));
    it('WebVTT sai thứ tự cue → 422 media_corrupted', () =>
      expectRejected(buildVtt('WEBVTT\n\n00:05.000 --> 00:06.000\nA\n\n00:01.000 --> 00:02.000\nB\n'), MediaErrorCode.CORRUPTED));

    it('thông báo lỗi 422 nêu rõ trường "file" và lý do', async () => {
      await assert.rejects(service.upload(file(SVG_FILE), dto(), ACTOR_ID), (error: unknown) => {
        const body = (error as HttpException).getResponse() as { message: string; errors: Array<{ field: string; message: string }> };
        assert.match(body.message, /SVG/);
        assert.equal(body.errors[0].field, 'file');
        assert.equal(body.errors[0].message, body.message);
        return true;
      });
    });
  });

  // ---------------------------------------------------------------- quarantine
  describe('upload — quarantine khi lỗi không rõ nguyên nhân', () => {
    it('lỗi bất thường khi phân tích → lưu vào vùng cách ly, trạng thái quarantined, trả 422', async () => {
      inspection.structureError = new RangeError('đọc vượt biên ngoài dự kiến');
      const buffer = buildPng();
      await expectHttpError(service.upload(file(buffer, 'nghi-ngo.png'), dto({ source: 'X' }), ACTOR_ID), UnprocessableEntityException, MediaErrorCode.QUARANTINED, /cách ly/);

      const record = repo.only();
      assert.equal(record.processingState, MediaProcessingState.QUARANTINED);
      assert.match(record.storageKey, /^quarantine\/.+\.bin$/);
      assert.equal(record.source, 'X');
      assert.deepEqual(listFiles(publicRoot), [], 'không được nằm trong vùng public');
      const quarantined = listFiles(quarantineRoot);
      assert.equal(quarantined.length, 1);
      assert.ok((await readFile(quarantined[0])).equals(buffer));
    });

    it('thông báo quarantine chứa mã media để quản trị viên tra cứu', async () => {
      inspection.structureError = new TypeError('x');
      await assert.rejects(service.upload(file(buildPng()), dto(), ACTOR_ID), (error: unknown) => {
        const body = (error as HttpException).getResponse() as { message: string };
        assert.ok(body.message.includes(repo.only().id));
        return true;
      });
    });

    it('media quarantine không có URL công khai', async () => {
      inspection.structureError = new Error('x');
      await assert.rejects(service.upload(file(buildPng()), dto(), ACTOR_ID));
      assert.equal((await service.getById(repo.only().id)).url, null);
    });

    it('lỗi bất thường không phải Error (vd chuỗi) vẫn được cách ly', async () => {
      inspection.structureError = 'boom';
      await expectHttpError(service.upload(file(buildPng()), dto(), ACTOR_ID), UnprocessableEntityException, MediaErrorCode.QUARANTINED);
    });

    it('MediaFormatError KHÔNG bị cách ly — chỉ từ chối', async () => {
      inspection.structureError = new MediaFormatError(MediaErrorCode.CORRUPTED, 'hỏng');
      await expectHttpError(service.upload(file(buildPng()), dto(), ACTOR_ID), UnprocessableEntityException, MediaErrorCode.CORRUPTED);
      assert.equal(repo.rows.size, 0);
      assert.deepEqual(listFiles(quarantineRoot), []);
    });
  });

  // ---------------------------------------------------------------- lỗi hạ tầng
  describe('upload — lỗi hạ tầng', () => {
    it('ghi DB thất bại → dọn file vừa lưu, ném lỗi gốc', async () => {
      repo.saveError = new Error('db down');
      await assert.rejects(service.upload(file(buildPng()), dto(), ACTOR_ID), /db down/);
      assert.deepEqual(listFiles(publicRoot), []);
    });

    it('ghi DB thất bại và dọn file cũng lỗi → vẫn ném lỗi DB gốc', async () => {
      repo.saveError = new Error('db down');
      storage.removeError = new Error('disk busy');
      await assert.rejects(service.upload(file(buildPng()), dto(), ACTOR_ID), /db down/);
    });

    it('ghi file thất bại → không tạo bản ghi', async () => {
      storage.saveError = new Error('disk full');
      await assert.rejects(service.upload(file(buildPng()), dto(), ACTOR_ID), /disk full/);
      assert.equal(repo.rows.size, 0);
    });
  });

  // ---------------------------------------------------------------- list / get / update
  describe('list / getById / update', () => {
    it('list ánh xạ response kèm URL và truyền query xuống repository', async () => {
      await service.upload(file(buildPng()), dto(), ACTOR_ID);
      const query = Object.assign(new ListMediaQueryDto(), { kind: MediaKind.IMAGE });
      const result = await service.list(query);
      assert.equal(result.total, 1);
      assert.match(String(result.items[0].url), signedUrlPattern('images', 'png'));
      assert.equal(repo.listQueries[0], query);
      assert.equal('storageKey' in result.items[0], false);
    });

    it('getById không tồn tại → 404', async () => {
      await assert.rejects(service.getById(randomUUID()), NotFoundException);
    });

    it('openContent trả đúng nội dung file của media ready', async () => {
      const png = buildPng();
      const uploaded = await service.upload(file(png), dto(), ACTOR_ID);
      const { media, stream } = await service.openContent(uploaded.id);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
      assert.equal(media.id, uploaded.id);
      assert.deepEqual(Buffer.concat(chunks), png);
    });

    it('openContent media bị cách ly → 404, không đọc file ra ngoài', async () => {
      inspection.structureError = new Error('x');
      await assert.rejects(service.upload(file(buildPng()), dto(), ACTOR_ID));
      await assert.rejects(service.openContent(repo.only().id), NotFoundException);
    });

    it('getById media đã xóa → 404', async () => {
      const uploaded = await service.upload(file(buildPng()), dto(), ACTOR_ID);
      await service.remove(uploaded.id);
      await assert.rejects(service.getById(uploaded.id), NotFoundException);
    });

    it('update chỉ đổi trường được gửi, giữ nguyên trường khác', async () => {
      const uploaded = await service.upload(file(buildPng()), dto({ source: 'Nguồn cũ', author: 'Tác giả' }), ACTOR_ID);
      const updated = await service.update(uploaded.id, { license: 'CC0' });
      assert.equal(updated.license, 'CC0');
      assert.equal(updated.source, 'Nguồn cũ');
      assert.equal(updated.author, 'Tác giả');
    });

    it('update null → xóa giá trị', async () => {
      const uploaded = await service.upload(file(buildPng()), dto({ source: 'Nguồn' }), ACTOR_ID);
      assert.equal((await service.update(uploaded.id, { source: null })).source, null);
    });

    it('update KHÔNG thay đổi file, url, mime, checksum (không ghi đè media)', async () => {
      const uploaded = await service.upload(file(buildPng()), dto(), ACTOR_ID);
      const updated = await service.update(uploaded.id, { altText: 'Mới' });
      assert.equal(updated.url, uploaded.url);
      assert.equal(updated.mimeType, uploaded.mimeType);
      assert.equal(updated.checksumSha256, uploaded.checksumSha256);
    });

    it('update media không tồn tại → 404', async () => {
      await assert.rejects(service.update(randomUUID(), { license: 'x' }), NotFoundException);
    });
  });

  // ---------------------------------------------------------------- remove (BR-21)
  describe('remove — BR-21', () => {
    it('media không được dùng → xóa mềm, GIỮ file để khôi phục được, chạy trong transaction', async () => {
      const uploaded = await service.upload(file(buildPng()), dto(), ACTOR_ID);
      const key = repo.only().storageKey;
      await service.remove(uploaded.id);

      const row = repo.rows.get(uploaded.id);
      assert.equal(row?.isDeleted, true);
      assert.ok(row?.deletedAt instanceof Date);
      assert.equal(existsSync(join(publicRoot, key)), true, 'xóa mềm không xóa file');
      assert.deepEqual(storage.removed, []);
      assert.equal(tx.runs, 1);
      assert.deepEqual(repo.lockCalls, [{ id: uploaded.id, manager: FAKE_MANAGER }]);
      assert.equal(repo.usageCalls[0].manager, FAKE_MANAGER, 'kiểm tra tham chiếu phải cùng transaction');
      assert.equal(repo.saveManagers.at(-1), FAKE_MANAGER, 'xóa mềm phải cùng transaction');
    });

    it('media đang được exhibit đã xuất bản dùng → 409, không xóa gì', async () => {
      const uploaded = await service.upload(file(buildPng()), dto(), ACTOR_ID);
      repo.usage = { publishedExhibits: 2, pendingRevisions: 0 };
      await assert.rejects(service.remove(uploaded.id), (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        assert.match(error.message, /2 hiện vật đã xuất bản.*BR-21/);
        return true;
      });
      assert.equal(repo.rows.get(uploaded.id)?.isDeleted, false);
      assert.equal(existsSync(join(publicRoot, repo.only().storageKey)), true);
      assert.deepEqual(storage.removed, []);
    });

    it('media đang trong nội dung chờ duyệt → 409', async () => {
      const uploaded = await service.upload(file(buildPng()), dto(), ACTOR_ID);
      repo.usage = { publishedExhibits: 0, pendingRevisions: 1 };
      await assert.rejects(service.remove(uploaded.id), /chờ duyệt/);
      assert.equal(repo.rows.get(uploaded.id)?.isDeleted, false);
    });

    it('media không tồn tại → 404, không kiểm tra tham chiếu', async () => {
      await assert.rejects(service.remove(randomUUID()), NotFoundException);
      assert.equal(repo.usageCalls.length, 0);
    });

    it('xóa lần hai → 404', async () => {
      const uploaded = await service.upload(file(buildPng()), dto(), ACTOR_ID);
      await service.remove(uploaded.id);
      await assert.rejects(service.remove(uploaded.id), NotFoundException);
    });

    it('storage lỗi cũng không ảnh hưởng: xóa mềm không gọi tới storage', async () => {
      const uploaded = await service.upload(file(buildPng()), dto(), ACTOR_ID);
      storage.removeError = new Error('EACCES');
      await assert.doesNotReject(service.remove(uploaded.id));
      assert.equal(repo.rows.get(uploaded.id)?.isDeleted, true);
    });

    it('xóa media quarantine → xóa mềm, file vẫn nằm trong vùng cách ly', async () => {
      inspection.structureError = new Error('x');
      await assert.rejects(service.upload(file(buildPng()), dto(), ACTOR_ID));
      await service.remove(repo.only().id);
      assert.equal(repo.only().isDeleted, true);
      assert.equal(listFiles(quarantineRoot).length, 1);
    });

    it('removeMany: hợp lệ hết → xóa mềm tất cả trong MỘT transaction, giữ file, trả { ids }', async () => {
      const first = await service.upload(file(buildPng()), dto(), ACTOR_ID);
      const second = await service.upload(file(buildPng()), dto(), ACTOR_ID);
      const runsBefore = tx.runs;
      assert.deepEqual(await service.removeMany([first.id, second.id]), { ids: [first.id, second.id] });
      assert.equal(tx.runs - runsBefore, 1);
      assert.equal(repo.rows.get(first.id)?.isDeleted && repo.rows.get(second.id)?.isDeleted, true);
      assert.deepEqual(storage.removed, []);
    });

    it('removeMany: 1 media bị chặn (BR-21) hoặc không tồn tại → 409 liệt kê từng ID, không media nào bị xóa', async () => {
      const first = await service.upload(file(buildPng()), dto(), ACTOR_ID);
      const ghost = randomUUID();
      repo.usage = { publishedExhibits: 1, pendingRevisions: 0 };
      await assert.rejects(service.removeMany([first.id, ghost]), (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        const body = error.getResponse() as { errors: Array<{ field: string; message: string }> };
        assert.deepEqual(body.errors.map((e) => e.field).sort(), [first.id, ghost].sort());
        assert.match(body.errors.find((e) => e.field === first.id)!.message, /BR-21/);
        return true;
      });
      assert.equal(repo.rows.get(first.id)?.isDeleted, false);
    });
  });
});

describe('sanitizeOriginalName', () => {
  it('giữ nguyên tên ASCII', () => assert.equal(sanitizeOriginalName('trong-dong.png'), 'trong-dong.png'));
  it('khôi phục tên tiếng Việt UTF-8 bị đọc thành latin1', () => {
    const mojibake = Buffer.from('Trống đồng.png', 'utf8').toString('latin1');
    assert.equal(sanitizeOriginalName(mojibake), 'Trống đồng.png');
  });
  it('giữ nguyên chuỗi Unicode đã đúng', () => assert.equal(sanitizeOriginalName('Trống đồng.png'), 'Trống đồng.png'));
  it('giữ nguyên ký tự latin1 thật không phải UTF-8 hợp lệ', () => assert.equal(sanitizeOriginalName('caf\u00e9.png'), 'caf\u00e9.png'));
  it('bỏ phần đường dẫn Unix', () => assert.equal(sanitizeOriginalName('../../etc/passwd.png'), 'passwd.png'));
  it('bỏ phần đường dẫn Windows', () => assert.equal(sanitizeOriginalName('C:\\Users\\a\\anh.png'), 'anh.png'));
  it('bỏ ký tự điều khiển', () => assert.equal(sanitizeOriginalName('a\u0000b\nc\u007f.png'), 'abc.png'));
  it('cắt còn 255 ký tự', () => assert.equal(sanitizeOriginalName(`${'a'.repeat(300)}.png`)?.length, 255));
  it('không cắt đôi ký tự nhiều byte khi giới hạn độ dài', () => {
    const name = sanitizeOriginalName('😀'.repeat(300));
    assert.equal(Array.from(name ?? '').length, 255);
    assert.ok(!(name ?? '').includes('\ufffd'));
  });
  it('chỉ có đường dẫn → null', () => assert.equal(sanitizeOriginalName('folder/'), null));
  it('chuỗi rỗng → null', () => assert.equal(sanitizeOriginalName('   '), null));
  it('không phải chuỗi → null', () => assert.equal(sanitizeOriginalName(undefined), null));
});
