import 'reflect-metadata';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { MEDIA_FORMAT_SPECS, MediaFormat } from '../inspection/media-formats';
import {
  DEFAULT_MEDIA_STORAGE_ROOTS,
  MediaStorageService,
  PUBLIC_MEDIA_URL_PREFIX,
} from '../services/media-storage.service';

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

describe('MediaStorageService', () => {
  let workDir: string;
  let publicRoot: string;
  let quarantineRoot: string;
  let storage: MediaStorageService;

  before(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'media-storage-'));
    publicRoot = join(workDir, 'public', 'media');
    quarantineRoot = join(workDir, 'storage', 'quarantine');
    storage = new MediaStorageService({ publicRoot, quarantineRoot });
  });

  after(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  describe('createKey', () => {
    const cases: Array<[MediaFormat, string]> = [
      [MediaFormat.GLB, `^uploads/models/${UUID_PATTERN}\\.glb$`],
      [MediaFormat.PNG, `^uploads/images/${UUID_PATTERN}\\.png$`],
      [MediaFormat.JPEG, `^uploads/images/${UUID_PATTERN}\\.jpg$`],
      [MediaFormat.WEBP, `^uploads/images/${UUID_PATTERN}\\.webp$`],
      [MediaFormat.MP3, `^uploads/audio/${UUID_PATTERN}\\.mp3$`],
      [MediaFormat.VTT, `^uploads/subtitles/${UUID_PATTERN}\\.vtt$`],
    ];
    for (const [format, pattern] of cases) {
      it(`${format} → ${pattern}`, () => {
        assert.match(storage.createKey(MEDIA_FORMAT_SPECS[format]), new RegExp(pattern));
      });
    }

    it('file quarantine → quarantine/<uuid>.bin (không giữ phần mở rộng)', () => {
      assert.match(storage.createKey(MEDIA_FORMAT_SPECS[MediaFormat.PNG], true), new RegExp(`^quarantine/${UUID_PATTERN}\\.bin$`));
    });

    it('mỗi lần gọi sinh key khác nhau', () => {
      const keys = new Set(Array.from({ length: 200 }, () => storage.createKey(MEDIA_FORMAT_SPECS[MediaFormat.PNG])));
      assert.equal(keys.size, 200);
    });
  });

  describe('save / remove', () => {
    it('ghi file vào vùng public và tự tạo thư mục con', async () => {
      const key = storage.createKey(MEDIA_FORMAT_SPECS[MediaFormat.PNG]);
      await storage.save(key, Buffer.from('png-bytes'));
      assert.equal((await readFile(join(publicRoot, key))).toString(), 'png-bytes');
    });

    it('file quarantine nằm ngoài thư mục public', async () => {
      const key = storage.createKey(MEDIA_FORMAT_SPECS[MediaFormat.GLB], true);
      await storage.save(key, Buffer.from('suspicious'));
      const fileName = key.slice('quarantine/'.length);
      assert.equal((await readFile(join(quarantineRoot, fileName))).toString(), 'suspicious');
      assert.equal(existsSync(join(publicRoot, key)), false);
      assert.ok(!resolve(quarantineRoot, fileName).startsWith(resolve(publicRoot)));
    });

    it('KHÔNG ghi đè file đã tồn tại (BR-21) — báo EEXIST, nội dung cũ giữ nguyên', async () => {
      const key = storage.createKey(MEDIA_FORMAT_SPECS[MediaFormat.MP3]);
      await storage.save(key, Buffer.from('original'));
      await assert.rejects(storage.save(key, Buffer.from('replacement')), { code: 'EEXIST' });
      assert.equal((await readFile(join(publicRoot, key))).toString(), 'original');
    });

    it('remove xóa file đã lưu', async () => {
      const key = storage.createKey(MEDIA_FORMAT_SPECS[MediaFormat.VTT]);
      await storage.save(key, Buffer.from('WEBVTT'));
      await storage.remove(key);
      assert.equal(existsSync(join(publicRoot, key)), false);
    });

    it('remove xóa file quarantine', async () => {
      const key = storage.createKey(MEDIA_FORMAT_SPECS[MediaFormat.PNG], true);
      await storage.save(key, Buffer.from('x'));
      await storage.remove(key);
      assert.equal(existsSync(join(quarantineRoot, key.slice('quarantine/'.length))), false);
    });

    it('remove file không tồn tại không báo lỗi', async () => {
      await assert.doesNotReject(storage.remove('uploads/images/khong-ton-tai.png'));
    });

    const unsafeKeys = [
      '../escape.png',
      'uploads/../../escape.png',
      '/etc/passwd',
      'uploads\\images\\x.png',
      'uploads//x.png',
      'Uploads/X.PNG',
      'uploads/images/x.png/',
      '',
      '.hidden',
      'quarantine/../../escape.bin',
    ];
    for (const key of unsafeKeys) {
      it(`từ chối key không an toàn: ${JSON.stringify(key)}`, async () => {
        await assert.rejects(storage.save(key, Buffer.from('x')), /Storage key không hợp lệ/);
        await assert.rejects(storage.remove(key), /Storage key không hợp lệ/);
      });
    }

    it('key "quarantine/" rỗng phần tên → từ chối', async () => {
      await assert.rejects(storage.save('quarantine/', Buffer.from('x')), /Storage key không hợp lệ/);
    });
  });

  describe('toPublicUrl', () => {
    it('file public → /media/<key>', () => {
      assert.equal(storage.toPublicUrl('uploads/images/a.png'), `${PUBLIC_MEDIA_URL_PREFIX}/uploads/images/a.png`);
    });

    it('file quarantine → null (không lộ ra ngoài)', () => {
      assert.equal(storage.toPublicUrl('quarantine/a.bin'), null);
    });

    it('isQuarantineKey phân biệt đúng', () => {
      assert.equal(storage.isQuarantineKey('quarantine/a.bin'), true);
      assert.equal(storage.isQuarantineKey('uploads/images/a.png'), false);
    });
  });

  describe('Cấu hình mặc định', () => {
    it('vùng quarantine mặc định nằm ngoài thư mục public', () => {
      const publicDir = resolve(DEFAULT_MEDIA_STORAGE_ROOTS.publicRoot);
      assert.ok(!resolve(DEFAULT_MEDIA_STORAGE_ROOTS.quarantineRoot).startsWith(publicDir));
    });

    it('vùng public mặc định là public/media (thư mục main.ts phục vụ tĩnh)', () => {
      assert.ok(DEFAULT_MEDIA_STORAGE_ROOTS.publicRoot.endsWith(join('public', 'media')));
    });
  });
});
