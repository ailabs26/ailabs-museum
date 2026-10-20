import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { Paginated } from '../../../common/types/paginated.type';
import { ListMediaQueryDto } from '../dto/list-media-query.dto';
import { Media } from '../entities/media.entity';
import { MediaFormatSpec } from '../inspection/media-formats';
import { MediaUsage } from '../repositories/media.repository';
import { MediaInspectionService } from '../services/media-inspection.service';
import { MediaStorageService } from '../services/media-storage.service';

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
