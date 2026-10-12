import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataSource, ObjectLiteral, Repository } from 'typeorm';
import { ContentReport } from '../../content-reports/entities/content-report.entity';
import { ExhibitRevision } from '../../exhibits/entities/exhibit-revision.entity';
import { Exhibit } from '../../exhibits/entities/exhibit.entity';
import { Room } from '../../rooms/entities/room.entity';
import { StatsService } from '../services/stats.service';

/** Tạo repo giả: count() tra bảng kết quả theo chữ ký JSON của điều kiện where. */
function fakeRepo<T extends ObjectLiteral>(table: Record<string, number>): Repository<T> {
  return {
    count: ({ where }: { where: Record<string, unknown> }) => {
      const key = JSON.stringify(where);
      return Promise.resolve(table[key] ?? 0);
    },
  } as unknown as Repository<T>;
}

function fakeDataSource(dbUp: boolean): DataSource {
  return {
    query: () => (dbUp ? Promise.resolve([{ '?column?': 1 }]) : Promise.reject(new Error('db down'))),
  } as unknown as DataSource;
}

function buildService(dbUp = true): StatsService {
  const rooms = fakeRepo<Room>({
    [JSON.stringify({ isDeleted: false })]: 12,
    [JSON.stringify({ isDeleted: false, status: 'active' })]: 9,
    [JSON.stringify({ isDeleted: false, status: 'archived' })]: 3,
  });
  const exhibits = fakeRepo<Exhibit>({
    [JSON.stringify({ isDeleted: false })]: 48,
    [JSON.stringify({ isDeleted: false, visibility: 'visible' })]: 40,
    [JSON.stringify({ isDeleted: false, visibility: 'hidden' })]: 8,
  });
  const revisions = fakeRepo<ExhibitRevision>({
    [JSON.stringify({ state: 'in_review' })]: 5,
    [JSON.stringify({ state: 'draft' })]: 11,
  });
  const reports = fakeRepo<ContentReport>({
    [JSON.stringify({ status: 'open' })]: 4,
    [JSON.stringify({ status: 'in_progress' })]: 2,
  });
  return new StatsService(rooms, exhibits, revisions, reports, fakeDataSource(dbUp));
}

describe('StatsService.overview', () => {
  it('tổng hợp đúng số liệu rooms/exhibits/revisions/reports', async () => {
    const result = await buildService().overview();

    assert.deepEqual(result.rooms, { total: 12, active: 9, archived: 3 });
    assert.deepEqual(result.exhibits, { total: 48, visible: 40, hidden: 8 });
    assert.deepEqual(result.revisions, { inReview: 5, draft: 11 });
    assert.deepEqual(result.reports, { open: 4, inProgress: 2 });
  });

  it('system.db = "up" và uptime không âm khi DB phản hồi', async () => {
    const result = await buildService(true).overview();

    assert.equal(result.system.api, 'up');
    assert.equal(result.system.db, 'up');
    assert.ok(result.system.uptimeSec >= 0);
    assert.ok(!Number.isNaN(Date.parse(result.system.serverTime)));
  });

  it('system.db = "down" khi truy vấn SELECT 1 thất bại', async () => {
    const result = await buildService(false).overview();

    assert.equal(result.system.db, 'down');
    assert.equal(result.system.api, 'up');
  });
});
