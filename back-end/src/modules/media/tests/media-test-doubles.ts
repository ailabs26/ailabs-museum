import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { Paginated } from '../../../common/types/paginated.type';
import { ListMediaQueryDto } from '../dto/list-media-query.dto';
import { Media } from '../entities/media.entity';
import { MediaUploadJob, UploadJobStatus } from '../entities/media-upload-job.entity';
import { MediaFormatSpec } from '../inspection/media-formats';
import { NewUploadJob, UploadJobPatch } from '../repositories/media-upload-job.repository';
import { MediaUsage } from '../repositories/media.repository';
import { MediaInspectionService } from '../services/media-inspection.service';
import { MediaStorageService } from '../services/media-storage.service';
import { MediaUrlOptions, MediaUrlService } from '../services/media-url.service';
import { LocalStorageDriver, MediaStorageRoots } from '../storage/local-storage.driver';

/** Test double dùng chung cho test media. Không phải *.spec.ts nên node --test không chạy trực tiếp. */

export const FAKE_MANAGER = { fake: 'manager' } as unknown as EntityManager;

/** Repository trong bộ nhớ, mô phỏng các method MediaService dùng. */
export class FakeMediaRepository {
  rows = new Map<string, Media>();
  usage: MediaUsage = { publishedExhibits: 0, pendingRevisions: 0 };
  saveError?: Error;
  lockCalls: Array<{ id: string; manager: EntityManager }> = [];
  usageCalls: Array<{ id: string; manager?: EntityManager }> = [];
  saveManagers: Array<EntityManager | undefined> = [];
  listQueries: ListMediaQueryDto[] = [];

  create(data: Partial<Media>): Media {
    return Object.assign(new Media(), data);
  }

  async save(entity: Media, manager?: EntityManager): Promise<Media> {
    this.saveManagers.push(manager);
    if (this.saveError) throw this.saveError;
    const row = Object.assign(new Media(), entity);
    row.id ??= randomUUID();
    row.createdAt ??= new Date();
    row.isDeleted ??= false;
    row.deletedAt ??= null;
    this.rows.set(row.id, row);
    return Object.assign(new Media(), row);
  }

  async findActiveById(id: string): Promise<Media | null> {
    const row = this.rows.get(id);
    return row && !row.isDeleted ? Object.assign(new Media(), row) : null;
  }

  async lockActiveById(id: string, manager: EntityManager): Promise<Media | null> {
    this.lockCalls.push({ id, manager });
    return this.findActiveById(id);
  }

  async countUsage(id: string, manager?: EntityManager): Promise<MediaUsage> {
    this.usageCalls.push({ id, manager });
    return this.usage;
  }

  async listPaginated(query: ListMediaQueryDto): Promise<Paginated<Media>> {
    this.listQueries.push(query);
    const items = [...this.rows.values()].filter((row) => !row.isDeleted);
    return { items, total: items.length, page: query.page, pageSize: query.pageSize };
  }

  only(): Media {
    assert.equal(this.rows.size, 1, `kỳ vọng đúng 1 bản ghi, có ${this.rows.size}`);
    return [...this.rows.values()][0];
  }
}

export class FakeTransactionManager {
  runs = 0;
  async run<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    this.runs++;
    return work(FAKE_MANAGER);
  }
}

/** Inspection có thể bị "cài lỗi" để giả lập lỗi không rõ nguyên nhân khi phân tích. */
export class ControllableInspection extends MediaInspectionService {
  structureError?: unknown;
  override validateStructure(spec: MediaFormatSpec, buffer: Buffer): void {
    if (this.structureError !== undefined) throw this.structureError;
    super.validateStructure(spec, buffer);
  }
}

/** Storage thật trên đĩa, có thể "cài lỗi" ghi/xóa. */
export class FailingStorage extends MediaStorageService {
  constructor(roots: MediaStorageRoots) {
    super(new LocalStorageDriver(roots));
  }
  saveError?: Error;
  removeError?: Error;
  removed: string[] = [];
  override async save(key: string, data: Buffer): Promise<void> {
    if (this.saveError) throw this.saveError;
    return super.save(key, data);
  }
  override async remove(key: string): Promise<void> {
    this.removed.push(key);
    if (this.removeError) throw this.removeError;
    return super.remove(key);
  }
}

/** Cấu hình URL media dùng chung cho test (base URL cố định để assert dễ). */
export const TEST_MEDIA_URL_OPTIONS: MediaUrlOptions = {
  publicBaseUrl: 'http://api.test',
  signingSecret: 'test-media-url-signing-secret-0123456789',
  signedUrlTtlSeconds: 900,
};

export function testMediaUrlService(): MediaUrlService {
  return new MediaUrlService(TEST_MEDIA_URL_OPTIONS);
}

/**
 * Repository job trong bộ nhớ. `insertOrFindExisting` kiểm tra rồi ghi trong cùng một tick nên
 * mô phỏng đúng unique constraint (actor, key) — kể cả khi nhiều request chạy đồng thời.
 */
export class FakeUploadJobRepository {
  rows = new Map<string, MediaUploadJob>();
  /** Lịch sử patch theo thứ tự, để kiểm tra chuỗi trạng thái của worker. */
  patches: Array<{ id: string; data: UploadJobPatch }> = [];
  insertCalls = 0;

  async insertOrFindExisting(data: NewUploadJob): Promise<{ job: MediaUploadJob; created: boolean }> {
    this.insertCalls++;
    const existing = [...this.rows.values()].find(
      (row) => row.createdById === data.createdById && row.idempotencyKey === data.idempotencyKey,
    );
    if (existing) return { job: Object.assign(new MediaUploadJob(), existing), created: false };
    const now = new Date();
    const row = Object.assign(new MediaUploadJob(), {
      ...data,
      id: randomUUID(),
      status: UploadJobStatus.QUEUED,
      progress: 0,
      mediaId: null,
      errorCode: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    });
    this.rows.set(row.id, row);
    return { job: Object.assign(new MediaUploadJob(), row), created: true };
  }

  async findOwned(id: string, actorId: string): Promise<MediaUploadJob | null> {
    const row = this.rows.get(id);
    return row && row.createdById === actorId ? Object.assign(new MediaUploadJob(), row) : null;
  }

  async patch(id: string, data: UploadJobPatch): Promise<void> {
    this.patches.push({ id, data });
    const row = this.rows.get(id);
    if (row) Object.assign(row, data, { updatedAt: new Date() });
  }

  async failInterrupted(): Promise<number> {
    let count = 0;
    for (const row of this.rows.values()) {
      if (row.status === UploadJobStatus.QUEUED || row.status === UploadJobStatus.PROCESSING) {
        Object.assign(row, { status: UploadJobStatus.FAILED, progress: 100, errorCode: 'job_interrupted', updatedAt: new Date() });
        count++;
      }
    }
    return count;
  }

  /** Chèn sẵn một job ở trạng thái bất kỳ (dựng tình huống cho test). */
  seed(overrides: Partial<MediaUploadJob> = {}): MediaUploadJob {
    const now = new Date();
    const row = Object.assign(new MediaUploadJob(), {
      id: randomUUID(),
      createdById: randomUUID(),
      idempotencyKey: randomUUID(),
      requestChecksum: 'a'.repeat(64),
      status: UploadJobStatus.QUEUED,
      progress: 0,
      mediaId: null,
      errorCode: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    });
    this.rows.set(row.id, row);
    return row;
  }
}

/** Regex URL đã ký cho file `uploads/<dir>/<uuid>.<ext>`. */
export function signedUrlPattern(dir: string, extension: string): RegExp {
  return new RegExp(`^http://api\\.test/media/uploads/${dir}/[0-9a-f-]{36}\\.${extension}\\?exp=\\d+&sig=[0-9a-f]{64}$`);
}
