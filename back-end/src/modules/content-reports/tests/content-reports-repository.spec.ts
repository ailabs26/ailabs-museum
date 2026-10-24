import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Repository } from 'typeorm';
import { Exhibit } from '../../exhibits/entities/exhibit.entity';
import { ExhibitRevision, RevisionState } from '../../exhibits/entities/exhibit-revision.entity';
import { ContentReport } from '../entities/content-report.entity';
import { ContentReportsRepository } from '../repositories/content-reports.repository';

describe('ContentReportsRepository.revisionBelongsToExhibit', () => {
  it('only accepts an approved revision belonging to the reported exhibit', async () => {
    let criteria: unknown;
    const revisions = {
      count: async (options: { where: unknown }) => { criteria = options.where; return 1; },
    } as unknown as Repository<ExhibitRevision>;
    const repo = new ContentReportsRepository(
      {} as Repository<ContentReport>,
      {} as Repository<Exhibit>,
      revisions,
    );

    assert.equal(await repo.revisionBelongsToExhibit('revision-id', 'exhibit-id'), true);
    assert.deepEqual(criteria, { id: 'revision-id', exhibitId: 'exhibit-id', state: RevisionState.APPROVED });
  });
});
