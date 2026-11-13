import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import type { ConfigService } from '@nestjs/config';
import type { EntityManager } from 'typeorm';
import type { TransactionManager } from '../../../common/database/transaction.manager';
import type { AuditService, RecordAuditInput } from '../../audit/services/audit.service';
import type { MediaRepository } from '../repositories/media.repository';
import { MediaCleanupService, ORPHAN_FILE_GRACE_MS } from '../services/media-cleanup.service';
import { MediaStorageService } from '../services/media-storage.service';
import { LocalStorageDriver } from '../storage/local-storage.driver';
import type { MediaStorageDriver, StoragePrefix, StoredObject } from '../storage/media-storage-driver';

const NOW = new Date('2026-11-03T03:30:00Z');
const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const UUID_C = '33333333-3333-4333-8333-333333333333';
const old = new Date(NOW.getTime() - ORPHAN_FILE_GRACE_MS - 1000);
const fresh = new Date(NOW.getTime() - 60_000);

describe('MediaStorageService.isManagedKey', () => {
  const storage = new MediaStorageService({} as MediaStorageDriver);
  it('chỉ nhận đúng key do createKey sinh ra', () => {
    for (const key of [`uploads/images/${UUID_A}.png`, `uploads/models/${UUID_A}.glb`, `uploads/audio/${UUID_A}.mp3`,
      `uploads/subtitles/${UUID_A}.vtt`, `quarantine/${UUID_A}.bin`]) {
      assert.equal(storage.isManagedKey(key), true, key);
    }
  });
  it('từ chối model phòng, seed, thư mục lạ, tên không phải uuid, đường dẫn lồng, quarantine sai đuôi', () => {
    for (const key of ['rooms/phong-gom.glb', 'models/room.glb', `uploads/other/${UUID_A}.png`, 'uploads/images/logo.png',
      `uploads/images/x/${UUID_A}.png`, `quarantine/${UUID_A}.png`, `uploads/images/${UUID_A}.png.bak`, `../uploads/images/${UUID_A}.png`]) {
      assert.equal(storage.isManagedKey(key), false, key);
    }
  });
});

describe('LocalStorageDriver.list', () => {
  it('liệt kê đệ quy uploads/ dưới publicRoot và quarantine/ dưới quarantineRoot, key dạng /, thư mục thiếu → rỗng', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'media-list-'));
    try {
      const driver = new LocalStorageDriver({ publicRoot: join(dir, 'public'), quarantineRoot: join(dir, 'q') });
      const collect = async (prefix: StoragePrefix) => {
        const keys: string[] = [];
        for await (const object of driver.list(prefix)) keys.push(object.key);
        return keys.sort();
      };
      assert.deepEqual(await collect('uploads/'), []);
      await mkdir(join(dir, 'public', 'uploads', 'images'), { recursive: true });
      await writeFile(join(dir, 'public', 'uploads', 'images', `${UUID_A}.png`), 'x');
      await writeFile(join(dir, 'public', 'outside.txt'), 'x'); // ngoài uploads/ → không liệt kê
      await mkdir(join(dir, 'q'), { recursive: true });
      await writeFile(join(dir, 'q', `${UUID_B}.bin`), 'x');
      assert.deepEqual(await collect('uploads/'), [`uploads/images/${UUID_A}.png`]);
      assert.deepEqual(await collect('quarantine/'), [`quarantine/${UUID_B}.bin`]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

/** Dựng service với repo/storage/audit giả để kiểm logic từng chế độ. */
function harness(options: {
  purgeable?: { id: string; storageKey: string }[];
  stored?: StoredObject[];
  existingKeys?: string[];
  failRemove?: string[];
}) {
  const removedFiles: string[] = [];
  const audits: RecordAuditInput[] = [];
  let purgeable = [...(options.purgeable ?? [])];
  const repo = {
    countPurgeable: async () => purgeable.length,
    deletePurgeable: async (_cutoff: Date, limit: number) => {
      const batch = purgeable.slice(0, limit);
      purgeable = purgeable.slice(limit);
      return batch;
    },
    findExistingStorageKeys: async (keys: string[]) => new Set(keys.filter((k) => options.existingKeys?.includes(k))),
  } as unknown as MediaRepository;
  const storage = {
    async *listManaged() { yield* options.stored ?? []; },
    remove: async (key: string) => {
      if (options.failRemove?.includes(key)) throw new Error('storage down');
      removedFiles.push(key);
    },
  } as unknown as MediaStorageService;
  const tx = { run: <T>(work: (m: EntityManager) => Promise<T>) => work({} as EntityManager) } as TransactionManager;
  const audit = { recordSafely: async (input: RecordAuditInput) => { audits.push(input); } } as unknown as AuditService;
  const config = { get: (key: string) => (key === 'media.trashRetentionDays' ? 30 : undefined) } as unknown as ConfigService;
  return { service: new MediaCleanupService(repo, storage, tx, audit, config), removedFiles, audits };
}

describe('MediaCleanupService', () => {
  const purgeable = [{ id: UUID_A, storageKey: `uploads/images/${UUID_A}.png` }];
  const stored: StoredObject[] = [
    { key: `uploads/images/${UUID_B}.png`, lastModified: old },   // mồ côi, cũ → xóa
    { key: `uploads/images/${UUID_C}.png`, lastModified: fresh }, // mồ côi nhưng mới (upload dở) → giữ
    { key: `quarantine/${UUID_A}.bin`, lastModified: old },       // có bản ghi → giữ
  ];

  it('dry-run: chỉ đếm, không xóa file, không ghi audit', async () => {
    const { service, removedFiles, audits } = harness({ purgeable, stored, existingKeys: [`quarantine/${UUID_A}.bin`] });
    assert.deepEqual(await service.run('dry-run', NOW), { mode: 'dry-run', purgedMedia: 1, orphanFiles: 1, errors: 0 });
    assert.deepEqual(removedFiles, []);
    assert.deepEqual(audits, []);
  });

  it('on: xóa bản ghi quá hạn + ghi audit media.purge + xóa file; xóa file mồ côi cũ, giữ file mới và file có bản ghi', async () => {
    const { service, removedFiles, audits } = harness({ purgeable, stored, existingKeys: [`quarantine/${UUID_A}.bin`] });
    assert.deepEqual(await service.run('on', NOW), { mode: 'on', purgedMedia: 1, orphanFiles: 1, errors: 0 });
    assert.deepEqual(removedFiles, [`uploads/images/${UUID_A}.png`, `uploads/images/${UUID_B}.png`]);
    assert.deepEqual(audits.map((a) => [a.action, a.actorId, a.resourceType, a.resourceId]), [['media.purge', null, 'media', UUID_A]]);
    assert.deepEqual(JSON.parse(audits[0].reason!), { storageKey: `uploads/images/${UUID_A}.png`, retentionDays: 30 });
  });

  it('on: lỗi xóa một file không dừng job, được đếm vào errors', async () => {
    const { service, removedFiles } = harness({
      purgeable: [...purgeable, { id: UUID_C, storageKey: `uploads/audio/${UUID_C}.mp3` }],
      stored, failRemove: [`uploads/images/${UUID_A}.png`],
    });
    const report = await service.run('on', NOW);
    assert.equal(report.purgedMedia, 2);
    assert.equal(report.errors, 1);
    assert.ok(removedFiles.includes(`uploads/audio/${UUID_C}.mp3`));
  });

  it('on: xóa theo lô tới khi hết (nhiều hơn một lô 200)', async () => {
    const many = Array.from({ length: 450 }, (_, i) => ({ id: `id-${i}`, storageKey: `k-${i}` }));
    const { service, audits } = harness({ purgeable: many });
    assert.equal((await service.run('on', NOW)).purgedMedia, 450);
    assert.equal(audits.length, 450);
  });

  it('cron: mode off → không chạy; lỗi bất ngờ → chỉ ghi log', async () => {
    const off = harness({ purgeable });
    (off.service as unknown as { config: ConfigService }).config = { get: () => 'off' } as unknown as ConfigService;
    await off.service.handleCron();
    assert.deepEqual(off.removedFiles, []);

    const broken = harness({});
    (broken.service as unknown as { media: unknown }).media = { countPurgeable: async () => { throw new Error('db down'); } };
    await assert.doesNotReject(broken.service.handleCron());
  });
});

