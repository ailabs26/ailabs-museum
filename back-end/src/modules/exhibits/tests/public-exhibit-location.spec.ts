import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { ExhibitsService } from '../services/exhibits.service';
import type { ExhibitsRepository } from '../repositories/exhibits.repository';

const ID = '10000000-0000-4000-8000-000000000001';

function serviceWith(location: { exhibitId: string; roomSlug: string } | null) {
  const repo = { findPublicLocation: async () => location } as unknown as ExhibitsRepository;
  const service = Object.create(ExhibitsService.prototype) as ExhibitsService;
  (service as unknown as { exhibits: ExhibitsRepository }).exhibits = repo;
  return service;
}

describe('ExhibitsService.publicLocation', () => {
  it('trả phòng chứa hiện vật công khai', async () => {
    assert.deepEqual(await serviceWith({ exhibitId: ID, roomSlug: 'gom' }).publicLocation(ID), { exhibitId: ID, roomSlug: 'gom' });
  });

  it('không công khai thì 404', async () => {
    await assert.rejects(serviceWith(null).publicLocation(ID), NotFoundException);
  });

  it('id không phải UUID bị chặn ở ParseUUIDPipe (400)', async () => {
    await assert.rejects(new ParseUUIDPipe().transform('abc', { type: 'param' }));
  });
});
