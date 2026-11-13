import 'reflect-metadata';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { resolve } from 'node:path';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { Exhibit } from '../../exhibits/entities/exhibit.entity';
import { ExhibitRevision, RevisionState } from '../../exhibits/entities/exhibit-revision.entity';
import { ListQueueQueryDto } from '../dto/list-queue-query.dto';
import { ModerationRepository } from '../repositories/moderation.repository';

describe('ModerationRepository joined queue pagination', () => {
  // Metadata only: no initialize(), DB connection, environment config or migrations.
  const db = new DataSource({ type: 'postgres', entities: [resolve(__dirname, '../../**/entities/*.entity.ts')], synchronize: false });
  before(async () => {
    await (db as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();
  });

  for (const populated of [false, true]) {
    it(`executes the full joined pagination path with an isolated SQL runner (populated=${populated})`, async () => {
      const runner = db.createQueryRunner();
      const sql: string[] = [];
      const id = '30000000-0000-4000-8000-000000000001';
      runner.query = async (query: string) => {
        sql.push(query);
        const records = query.includes('COUNT(') ? [{ cnt: '1' }]
          : !populated ? [] : query.includes('SELECT DISTINCT') ? [{ ids_rev_id: id, rev_created_at: new Date(), rev_id: id }]
          : [{ rev_id: id, rev_exhibit_id: '10000000-0000-4000-8000-000000000001', rev_revision_no: 1,
            rev_state: 'in_review', rev_content: { name: { vi: 'Bình gốm', en: 'Vase' } }, rev_created_at: new Date() }];
        return { records, raw: records, affected: records.length };
      };
      runner.release = async () => undefined;
      const revisions = db.getRepository(ExhibitRevision);
      const create = revisions.createQueryBuilder.bind(revisions);
      revisions.createQueryBuilder = () => create('rev', runner);
      try {
        const result = await new ModerationRepository(revisions, db.getRepository(Exhibit)).queue(new ListQueueQueryDto());
        assert.equal(result.items.length, populated ? 1 : 0);
        if (populated) assert.equal(result.items[0].id, id);
        assert.match(sql[0], /SELECT DISTINCT/);
        assert.match(sql[0], /rev_created_at/);
        assert.match(sql[0], /LIMIT 20/);
      } finally {
        delete (revisions as Partial<typeof revisions>).createQueryBuilder;
      }
    });
  }

  for (const page of [1, 2]) {
    it(`resolves actual TypeORM pagination order metadata on page ${page}`, async () => {
      const revisions = db.getRepository(ExhibitRevision);
      const builder = revisions.createQueryBuilder('rev');
      const items = [Object.assign(new ExhibitRevision(), { id: 'fixture-revision' })];
      let paginationSelect = '';
      // Exercise TypeORM's real joined-pagination order resolution at the DB boundary.
      // This internal method is version-specific; the production builder remains unchanged.
      builder.getManyAndCount = async () => {
        [paginationSelect] = (builder as unknown as {
          createOrderByCombinedWithSelectExpression(alias: string): [string, unknown];
        }).createOrderByCombinedWithSelectExpression('distinctAlias');
        return [items, 21];
      };
      revisions.createQueryBuilder = () => builder;
      try {
        const repository = new ModerationRepository(revisions, db.getRepository(Exhibit));
        const query = Object.assign(new ListQueueQueryDto(), { page, pageSize: 20, roomId: '60000000-0000-4000-8000-000000000001' });
        const result = await repository.queue(query);
        assert.deepEqual(result, { items, total: 21, page, pageSize: 20 });
        assert.match(paginationSelect, /rev_created_at/);
        assert.match(paginationSelect, /rev_id/);
        assert.deepEqual(builder.expressionMap.orderBys, { 'rev.createdAt': 'ASC', 'rev.id': 'ASC' });
        assert.equal(builder.expressionMap.skip, (page - 1) * 20);
        assert.equal(builder.expressionMap.take, 20);
        assert.equal(builder.getParameters().state, RevisionState.IN_REVIEW);
        assert.equal(builder.getParameters().roomId, query.roomId);
        assert.match(builder.getSql(), /exhibit.*room_id/);
      } finally {
        delete (revisions as Partial<typeof revisions>).createQueryBuilder;
      }
    });
  }

  it('keeps default pagination and omits the optional room filter', async () => {
    const revisions = db.getRepository(ExhibitRevision);
    let captured: SelectQueryBuilder<ExhibitRevision> | undefined;
    const create = revisions.createQueryBuilder.bind(revisions);
    revisions.createQueryBuilder = () => {
      captured = create('rev');
      captured.getManyAndCount = async () => [[], 0];
      return captured;
    };
    try {
      const result = await new ModerationRepository(revisions, db.getRepository(Exhibit)).queue(new ListQueueQueryDto());
      assert.deepEqual(result, { items: [], total: 0, page: 1, pageSize: 20 });
      assert.equal(captured?.getParameters().roomId, undefined);
    } finally {
      delete (revisions as Partial<typeof revisions>).createQueryBuilder;
    }
  });
});
