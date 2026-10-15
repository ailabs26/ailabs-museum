import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UnprocessableEntityException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ApiError } from '../../../common/dto/api-response';
import { Media, MediaKind, MediaProcessingState } from '../../media/entities/media.entity';
import { MediaReference, MediaReferenceValidator, checkMediaReferences } from '../../media/services/media-reference.validator';
import { ExhibitRevision, ExhibitRevisionContent } from '../entities/exhibit-revision.entity';
import { Hotspot } from '../entities/hotspot.entity';
import {
  RevisionPublishGate,
  TRANSCRIPT_MAX_LENGTH,
  checkContentForPublish,
  checkMediaForPublish,
} from '../services/revision-publish.gate';

const IDS = {
  model: 'a0000000-0000-4000-8000-000000000001',
  image: 'a0000000-0000-4000-8000-000000000002',
  audioVi: 'a0000000-0000-4000-8000-000000000003',
  audioEn: 'a0000000-0000-4000-8000-000000000004',
  subtitleVi: 'a0000000-0000-4000-8000-000000000005',
  subtitleEn: 'a0000000-0000-4000-8000-000000000006',
};
const KINDS: Record<keyof typeof IDS, MediaKind> = {
  model: MediaKind.MODEL,
  image: MediaKind.IMAGE,
  audioVi: MediaKind.AUDIO,
  audioEn: MediaKind.AUDIO,
  subtitleVi: MediaKind.SUBTITLE,
  subtitleEn: MediaKind.SUBTITLE,
};
const MANAGER = {} as EntityManager;

function media(key: keyof typeof IDS, overrides: Partial<Media> = {}): Media {
  return Object.assign(new Media(), {
    id: IDS[key],
    kind: KINDS[key],
    processingState: MediaProcessingState.READY,
    isDeleted: false,
    source: 'Bảo tàng',
    author: 'Tác giả',
    license: 'CC BY 4.0',
    ...overrides,
  });
}

const allMedia = () => new Map(Object.keys(IDS).map((key) => [IDS[key as keyof typeof IDS], media(key as keyof typeof IDS)]));

function hotspot(overrides: Partial<Hotspot> = {}): Hotspot {
  return Object.assign(new Hotspot(), {
    id: 'h1',
    label: JSON.stringify({ vi: 'Miệng', en: 'Rim' }),
    body: JSON.stringify({ vi: 'Chi tiết', en: 'Detail' }),
    positionX: '0.1',
    positionY: '0.2',
    positionZ: '0.3',
    displayOrder: 1,
    ...overrides,
  });
}

/** Revision đủ điều kiện publish với đủ 6 media. */
function revision(overrides: Partial<ExhibitRevision> = {}, content: Record<string, unknown> = {}): ExhibitRevision {
  return Object.assign(new ExhibitRevision(), {
    content: {
      name: { vi: 'Bình', en: 'Vase' },
      description: { vi: 'Mô tả', en: 'Description' },
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      altText: { vi: 'Ảnh', en: 'Photo' },
      transcript: { vi: 'Thuyết minh', en: 'Narration' },
      ...content,
    } as unknown as ExhibitRevisionContent,
    hotspots: [hotspot()],
    modelMediaId: IDS.model,
    imageMediaId: IDS.image,
    audioMediaId: IDS.audioVi,
    audioEnMediaId: IDS.audioEn,
    subtitleViMediaId: IDS.subtitleVi,
    subtitleEnMediaId: IDS.subtitleEn,
    ...overrides,
  });
}

const codes = (errors: ApiError[]) => errors.map((error) => `${error.field}:${error.code}`).sort();

describe('checkContentForPublish', () => {
  it('nội dung đủ (hotspot lưu dạng chuỗi JSON) → không lỗi', () => {
    assert.deepEqual(checkContentForPublish(revision()), []);
  });

  it('thiếu name.en / description.vi → lỗi có field', () => {
    const errors = checkContentForPublish(revision({}, { name: { vi: 'Bình' }, description: { en: 'Desc' } }));
    assert.deepEqual(codes(errors), ['description.vi:publish_content_invalid', 'name.en:publish_content_invalid']);
  });

  it('name chuỗi thường (dữ liệu cũ) → thiếu bản tiếng Anh', () => {
    assert.deepEqual(codes(checkContentForPublish(revision({}, { name: 'Bình' }))), ['name.en:publish_content_invalid']);
  });

  it('hotspot thiếu bản tiếng Anh', () => {
    const errors = checkContentForPublish(revision({ hotspots: [hotspot({ label: 'Chỉ tiếng Việt' })] }));
    assert.deepEqual(codes(errors), ['hotspots[0].label.en:publish_content_invalid']);
  });

  it('scale ≤ 0 → lỗi scale', () => {
    assert.deepEqual(codes(checkContentForPublish(revision({}, { scale: { x: 0, y: 1, z: 1 } }))), ['scale:publish_content_invalid']);
  });
});

describe('checkMediaForPublish', () => {
  it('đủ media, rights, alt, transcript, phụ đề → không lỗi', () => {
    assert.deepEqual(checkMediaForPublish(revision(), allMedia()), []);
  });

  it('không gắn media nào → không lỗi (media tùy chọn §5.2)', () => {
    const bare = revision({ modelMediaId: null, imageMediaId: null, audioMediaId: null, audioEnMediaId: null, subtitleViMediaId: null, subtitleEnMediaId: null }, { altText: null, transcript: null });
    assert.deepEqual(checkMediaForPublish(bare, new Map()), []);
  });

  for (const field of ['source', 'author', 'license'] as const) {
    it(`media thiếu ${field} (rỗng/khoảng trắng) → media_rights_missing`, () => {
      const map = allMedia();
      map.set(IDS.subtitleEn, media('subtitleEn', { [field]: '   ' }));
      const errors = checkMediaForPublish(revision(), map);
      assert.deepEqual(codes(errors), ['subtitleEnId:media_rights_missing']);
      assert.match(errors[0].message, new RegExp(field));
    });
  }

  it('báo rights thiếu cho từng slot', () => {
    const map = new Map([...allMedia()].map(([id, row]) => [id, Object.assign(row, { license: null })]));
    assert.equal(checkMediaForPublish(revision(), map).filter((e) => e.code === 'media_rights_missing').length, 6);
  });

  it('có ảnh, thiếu altText.en → image_alt_text_missing', () => {
    assert.deepEqual(codes(checkMediaForPublish(revision({}, { altText: { vi: 'Ảnh' } }), allMedia())), ['altText.en:image_alt_text_missing']);
  });

  it('altText chuỗi thường (chỉ vi) → thiếu en', () => {
    assert.deepEqual(codes(checkMediaForPublish(revision({}, { altText: 'Ảnh' }), allMedia())), ['altText.en:image_alt_text_missing']);
  });

  it('không có ảnh → không yêu cầu alt text', () => {
    assert.deepEqual(checkMediaForPublish(revision({ imageMediaId: null }, { altText: null }), allMedia()), []);
  });

  it('có audio vi, thiếu transcript vi → audio_transcript_missing', () => {
    assert.deepEqual(codes(checkMediaForPublish(revision({}, { transcript: { en: 'Narration' } }), allMedia())), ['transcript.vi:audio_transcript_missing']);
  });

  it('transcript chuỗi thường được hiểu là vi → audio en thiếu transcript', () => {
    assert.deepEqual(codes(checkMediaForPublish(revision({}, { transcript: 'Thuyết minh' }), allMedia())), ['transcript.en:audio_transcript_missing']);
  });

  it('có audio en, thiếu phụ đề en → audio_subtitle_missing', () => {
    assert.deepEqual(codes(checkMediaForPublish(revision({ subtitleEnMediaId: null }), allMedia())), ['subtitleEnId:audio_subtitle_missing']);
  });

  it('phụ đề vi không có audio vi → subtitle_without_audio', () => {
    assert.deepEqual(codes(checkMediaForPublish(revision({ audioMediaId: null }, {}), allMedia())), ['subtitleViId:subtitle_without_audio']);
  });

  it('chỉ có audio vi (+ phụ đề + transcript vi) → hợp lệ, không bắt audio en', () => {
    const viOnly = revision({ audioEnMediaId: null, subtitleEnMediaId: null }, { transcript: { vi: 'Thuyết minh' } });
    assert.deepEqual(checkMediaForPublish(viOnly, allMedia()), []);
  });

  it(`transcript ${TRANSCRIPT_MAX_LENGTH + 1} ký tự → transcript_too_long; đúng ${TRANSCRIPT_MAX_LENGTH} → hợp lệ`, () => {
    const tooLong = revision({}, { transcript: { vi: 'a'.repeat(TRANSCRIPT_MAX_LENGTH + 1), en: 'x' } });
    assert.deepEqual(codes(checkMediaForPublish(tooLong, allMedia())), ['transcript.vi:transcript_too_long']);
    const atLimit = revision({}, { transcript: { vi: 'a'.repeat(TRANSCRIPT_MAX_LENGTH), en: 'x' } });
    assert.deepEqual(checkMediaForPublish(atLimit, allMedia()), []);
  });
});

describe('RevisionPublishGate', () => {
  class FakeValidator {
    rows = allMedia();
    references: MediaReference[][] = [];
    async lockAndCheck(references: MediaReference[], manager: EntityManager) {
      assert.equal(manager, MANAGER);
      this.references.push(references);
      return { errors: checkMediaReferences(references, this.rows), mediaById: this.rows };
    }
  }

  const gateWith = (validator: FakeValidator) =>
    new RevisionPublishGate(validator as unknown as MediaReferenceValidator);

  it('revision hợp lệ → không ném lỗi, kiểm đủ 6 tham chiếu trong transaction', async () => {
    const validator = new FakeValidator();
    await gateWith(validator).assertPublishable(revision(), MANAGER);
    assert.equal(validator.references[0].length, 6);
  });

  it('gom lỗi nội dung + tham chiếu + luật media vào một 422', async () => {
    const validator = new FakeValidator();
    validator.rows.set(IDS.model, media('model', { isDeleted: true }));
    validator.rows.set(IDS.image, media('image', { license: '' }));
    const target = revision({ subtitleEnMediaId: null }, { name: { vi: 'Bình' } });
    await assert.rejects(gateWith(validator).assertPublishable(target, MANAGER), (error: unknown) => {
      assert.ok(error instanceof UnprocessableEntityException);
      const body = error.getResponse() as { errors: ApiError[] };
      assert.deepEqual(codes(body.errors), [
        'imageId:media_rights_missing',
        'modelId:media_not_found',
        'name.en:publish_content_invalid',
        'subtitleEnId:audio_subtitle_missing',
      ]);
      return true;
    });
  });

  it('slot lỗi tham chiếu không bị báo thêm lỗi rights', async () => {
    const validator = new FakeValidator();
    validator.rows.set(IDS.image, media('image', { processingState: MediaProcessingState.FAILED, license: null }));
    await assert.rejects(gateWith(validator).assertPublishable(revision(), MANAGER), (error: unknown) => {
      const body = (error as UnprocessableEntityException).getResponse() as { errors: ApiError[] };
      assert.deepEqual(codes(body.errors), ['imageId:media_not_ready']);
      return true;
    });
  });
});
