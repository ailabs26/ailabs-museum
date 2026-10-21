import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { MediaKind } from '../../media/entities/media.entity';
import { REVISION_MEDIA_RELATIONS, REVISION_MEDIA_SLOTS } from '../constants/revision-media-slots';
import { CreateExhibitDto } from '../dto/create-exhibit.dto';
import { UpdateExhibitDto } from '../dto/update-exhibit.dto';
import { primaryText, resolveBilingual } from '../utils/bilingual';
import {
  mediaReferencesOf,
  pickRevisionMedia,
  resolveRevisionMediaPatch,
} from '../utils/revision-media-patch';

const A = '0f8fad5b-d9cb-469f-a165-70867728950e';
const B = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

describe('REVISION_MEDIA_SLOTS', () => {
  it('đủ 6 slot, key/cột/field không trùng', () => {
    assert.equal(REVISION_MEDIA_SLOTS.length, 6);
    for (const prop of ['key', 'column', 'relation', 'dbColumn', 'dtoField'] as const) {
      assert.equal(new Set(REVISION_MEDIA_SLOTS.map((slot) => slot[prop])).size, 6, prop);
    }
  });

  it('relations nạp đủ 6 quan hệ media', () => {
    assert.deepEqual(Object.keys(REVISION_MEDIA_RELATIONS).sort(), REVISION_MEDIA_SLOTS.map((s) => s.relation).sort());
  });

  it('audio/phụ đề có locale; model/image không', () => {
    assert.deepEqual(
      REVISION_MEDIA_SLOTS.map((slot) => [slot.key, slot.kind, slot.locale]),
      [
        ['model', MediaKind.MODEL, null],
        ['image', MediaKind.IMAGE, null],
        ['audioVi', MediaKind.AUDIO, 'vi'],
        ['audioEn', MediaKind.AUDIO, 'en'],
        ['subtitleVi', MediaKind.SUBTITLE, 'vi'],
        ['subtitleEn', MediaKind.SUBTITLE, 'en'],
      ],
    );
  });
});

describe('resolveRevisionMediaPatch', () => {
  it('field vắng mặt → không có trong patch (giữ nguyên)', () => {
    assert.deepEqual(resolveRevisionMediaPatch({}), {});
  });

  it('null → tháo; UUID → gắn', () => {
    assert.deepEqual(resolveRevisionMediaPatch({ modelId: null, imageId: A, subtitleEnId: B }), {
      modelMediaId: null,
      imageMediaId: A,
      subtitleEnMediaId: B,
    });
  });

  it('audioId (cũ) là alias của audioViId', () => {
    assert.deepEqual(resolveRevisionMediaPatch({ audioId: A }), { audioMediaId: A });
    assert.deepEqual(resolveRevisionMediaPatch({ audioId: null }), { audioMediaId: null });
  });

  it('audioId và audioViId cùng giá trị → chấp nhận', () => {
    assert.deepEqual(resolveRevisionMediaPatch({ audioId: A, audioViId: A }), { audioMediaId: A });
  });

  it('audioViId được ưu tiên khi audioId vắng mặt', () => {
    assert.deepEqual(resolveRevisionMediaPatch({ audioViId: B, audioEnId: A }), { audioMediaId: B, audioEnMediaId: A });
  });

  for (const [label, input] of [
    ['khác UUID', { audioId: A, audioViId: B }],
    ['một bên null', { audioId: A, audioViId: null }],
  ] as const) {
    it(`audioId mâu thuẫn audioViId (${label}) → 400 audio_alias_conflict`, () => {
      assert.throws(() => resolveRevisionMediaPatch(input), (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        const body = error.getResponse() as { errors: Array<{ code: string; field: string }> };
        assert.equal(body.errors[0].code, 'audio_alias_conflict');
        assert.equal(body.errors[0].field, 'audioViId');
        return true;
      });
    });
  }
});

describe('mediaReferencesOf / pickRevisionMedia', () => {
  it('chỉ tham chiếu cột có id, kèm field DTO và kind', () => {
    assert.deepEqual(mediaReferencesOf({ modelMediaId: A, imageMediaId: null, subtitleViMediaId: B }), [
      { field: 'modelId', kind: MediaKind.MODEL, mediaId: A },
      { field: 'subtitleViId', kind: MediaKind.SUBTITLE, mediaId: B },
    ]);
  });

  it('pickRevisionMedia luôn trả đủ 6 cột, thiếu → null', () => {
    assert.deepEqual(pickRevisionMedia({ audioEnMediaId: A }), {
      modelMediaId: null,
      imageMediaId: null,
      audioMediaId: null,
      audioEnMediaId: A,
      subtitleViMediaId: null,
      subtitleEnMediaId: null,
    });
  });
});

describe('DTO create/update — field media mới', () => {
  for (const Dto of [CreateExhibitDto, UpdateExhibitDto]) {
    const base = Dto === CreateExhibitDto ? { roomId: A } : {};
    it(`${Dto.name}: nhận 4 field mới (UUID hoặc null)`, () => {
      const dto = plainToInstance(Dto, { ...base, audioViId: A, audioEnId: null, subtitleViId: B, subtitleEnId: null });
      assert.deepEqual(validateSync(dto), []);
    });

    for (const field of ['audioViId', 'audioEnId', 'subtitleViId', 'subtitleEnId']) {
      it(`${Dto.name}: ${field} không phải UUID → lỗi validate`, () => {
        const errors = validateSync(plainToInstance(Dto, { ...base, [field]: 'abc' }));
        assert.ok(errors.some((error) => error.property === field));
      });
    }
  }
});

describe('resolveBilingual', () => {
  const cases: Array<[string, unknown, { vi: string | null; en: string | null }]> = [
    ['chuỗi thường → vi', 'Bình gốm', { vi: 'Bình gốm', en: null }],
    ['object đủ', { vi: 'A', en: 'B' }, { vi: 'A', en: 'B' }],
    ['object thiếu en', { vi: 'A' }, { vi: 'A', en: null }],
    ['object chuỗi rỗng/khoảng trắng → null', { vi: '  ', en: '' }, { vi: null, en: null }],
    ['chuỗi JSON (cột varchar)', '{"vi":"Miệng","en":"Rim"}', { vi: 'Miệng', en: 'Rim' }],
    ['chuỗi bắt đầu bằng { nhưng không phải JSON', '{không phải json}', { vi: '{không phải json}', en: null }],
    ['JSON không có vi/en → văn bản thường', '{"a":1}', { vi: '{"a":1}', en: null }],
    ['giá trị không phải chuỗi trong object', { vi: 1, en: ['x'] }, { vi: null, en: null }],
    ['null', null, { vi: null, en: null }],
    ['undefined', undefined, { vi: null, en: null }],
    ['mảng', ['a'], { vi: null, en: null }],
    ['số', 42, { vi: null, en: null }],
  ];
  for (const [label, input, expected] of cases) {
    it(label, () => assert.deepEqual(resolveBilingual(input), expected));
  }

  it('primaryText: vi trước, thiếu thì en, không có → null', () => {
    assert.equal(primaryText({ vi: 'A', en: 'B' }), 'A');
    assert.equal(primaryText({ vi: null, en: 'B' }), 'B');
    assert.equal(primaryText({ vi: null, en: null }), null);
  });
});
