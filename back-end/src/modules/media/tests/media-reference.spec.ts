import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UnprocessableEntityException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Media, MediaKind, MediaProcessingState } from '../entities/media.entity';
import { MediaRepository } from '../repositories/media.repository';
import {
  MediaReference,
  MediaReferenceValidator,
  checkMediaReferences,
} from '../services/media-reference.validator';

const ID_A = '0f8fad5b-d9cb-469f-a165-70867728950e';
const ID_B = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const MANAGER = {} as EntityManager;

function media(overrides: Partial<Media> = {}): Media {
  return Object.assign(new Media(), {
    id: ID_A,
    kind: MediaKind.IMAGE,
    processingState: MediaProcessingState.READY,
    isDeleted: false,
    ...overrides,
  });
}

const ref = (overrides: Partial<MediaReference> = {}): MediaReference => ({
  field: 'imageId',
  kind: MediaKind.IMAGE,
  mediaId: ID_A,
  ...overrides,
});

describe('checkMediaReferences', () => {
  it('media ready, đúng kind → không lỗi', () => {
    assert.deepEqual(checkMediaReferences([ref()], new Map([[ID_A, media()]])), []);
  });

  it('không tồn tại → media_not_found, giữ field', () => {
    assert.deepEqual(
      checkMediaReferences([ref({ field: 'modelId', kind: MediaKind.MODEL })], new Map()).map((e) => [e.field, e.code]),
      [['modelId', 'media_not_found']],
    );
  });

  it('đã xóa mềm → media_not_found (không lộ trạng thái xóa)', () => {
    const errors = checkMediaReferences([ref()], new Map([[ID_A, media({ isDeleted: true })]]));
    assert.equal(errors[0].code, 'media_not_found');
  });

  for (const state of [MediaProcessingState.PENDING, MediaProcessingState.FAILED, MediaProcessingState.QUARANTINED]) {
    it(`trạng thái ${state} → media_not_ready`, () => {
      const errors = checkMediaReferences([ref()], new Map([[ID_A, media({ processingState: state })]]));
      assert.equal(errors[0].code, 'media_not_ready');
      assert.match(errors[0].message, new RegExp(state));
    });
  }

  const mismatches: Array<[MediaKind, MediaKind]> = [
    [MediaKind.IMAGE, MediaKind.MODEL],
    [MediaKind.SUBTITLE, MediaKind.AUDIO],
    [MediaKind.AUDIO, MediaKind.SUBTITLE],
    [MediaKind.MODEL, MediaKind.IMAGE],
  ];
  for (const [actual, expected] of mismatches) {
    it(`media ${actual} gắn vào ô ${expected} → media_kind_mismatch`, () => {
      const errors = checkMediaReferences([ref({ kind: expected })], new Map([[ID_A, media({ kind: actual })]]));
      assert.equal(errors[0].code, 'media_kind_mismatch');
    });
  }

  it('xóa mềm được ưu tiên báo trước trạng thái/kind', () => {
    const row = media({ isDeleted: true, processingState: MediaProcessingState.FAILED, kind: MediaKind.AUDIO });
    assert.equal(checkMediaReferences([ref()], new Map([[ID_A, row]]))[0].code, 'media_not_found');
  });

  it('gom đủ nhiều lỗi theo từng field', () => {
    const errors = checkMediaReferences(
      [ref(), ref({ field: 'modelId', kind: MediaKind.MODEL, mediaId: ID_B }), ref({ field: 'audioViId', kind: MediaKind.AUDIO })],
      new Map([[ID_A, media({ processingState: MediaProcessingState.PENDING })]]),
    );
    assert.deepEqual(errors.map((e) => [e.field, e.code]), [
      ['imageId', 'media_not_ready'],
      ['modelId', 'media_not_found'],
      ['audioViId', 'media_not_ready'],
    ]);
  });
});

describe('MediaReferenceValidator', () => {
  class FakeRepo {
    calls: string[][] = [];
    rows: Media[] = [];
    async lockByIds(ids: string[], manager: EntityManager): Promise<Media[]> {
      assert.equal(manager, MANAGER, 'phải khóa trong transaction của caller');
      this.calls.push(ids);
      return this.rows.filter((row) => ids.includes(row.id));
    }
  }

  it('không có tham chiếu → không truy vấn DB', async () => {
    const repo = new FakeRepo();
    const validator = new MediaReferenceValidator(repo as unknown as MediaRepository);
    await validator.assertAttachable([], MANAGER);
    assert.equal(repo.calls.length, 0);
  });

  it('một truy vấn khóa duy nhất cho mọi tham chiếu', async () => {
    const repo = new FakeRepo();
    repo.rows = [media(), media({ id: ID_B, kind: MediaKind.MODEL })];
    const validator = new MediaReferenceValidator(repo as unknown as MediaRepository);
    await validator.assertAttachable([ref(), ref({ field: 'modelId', kind: MediaKind.MODEL, mediaId: ID_B })], MANAGER);
    assert.deepEqual(repo.calls, [[ID_A, ID_B]]);
  });

  it('lỗi → 422 với danh sách errors {field, code}', async () => {
    const repo = new FakeRepo();
    const validator = new MediaReferenceValidator(repo as unknown as MediaRepository);
    await assert.rejects(validator.assertAttachable([ref()], MANAGER), (error: unknown) => {
      assert.ok(error instanceof UnprocessableEntityException);
      const body = error.getResponse() as { errors: Array<{ field: string; code: string }> };
      assert.deepEqual(body.errors.map((e) => [e.field, e.code]), [['imageId', 'media_not_found']]);
      return true;
    });
  });

  it('lockAndCheck trả kèm media đã khóa', async () => {
    const repo = new FakeRepo();
    repo.rows = [media()];
    const validator = new MediaReferenceValidator(repo as unknown as MediaRepository);
    const result = await validator.lockAndCheck([ref()], MANAGER);
    assert.deepEqual(result.errors, []);
    assert.equal(result.mediaById.get(ID_A)?.id, ID_A);
  });
});
