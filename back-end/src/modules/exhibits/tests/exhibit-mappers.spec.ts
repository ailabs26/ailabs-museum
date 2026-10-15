import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Media, MediaKind, MediaProcessingState } from '../../media/entities/media.entity';
import { User } from '../../users/entities/user.entity';
import { Exhibit, ExhibitVisibility } from '../entities/exhibit.entity';
import { ExhibitRevision, ExhibitRevisionContent, RevisionState } from '../entities/exhibit-revision.entity';
import { Hotspot } from '../entities/hotspot.entity';
import { toAdminRevision } from '../mappers/admin-revision.mapper';
import { toPublicExhibit } from '../mappers/public-exhibit.mapper';

const EXHIBIT_ID = 'e0000000-0000-4000-8000-000000000001';
const REVISION_ID = 'c0000000-0000-4000-8000-000000000001';
const url = (key: string) => (key.startsWith('uploads/') ? `http://api.test/media/${key}` : null);
const signed = (key: string) => `http://api.test/media/${key}?exp=1&sig=x`;

function media(kind: MediaKind, id: string, overrides: Partial<Media> = {}): Media {
  const ext = { model: 'glb', image: 'png', audio: 'mp3', subtitle: 'vtt' }[kind];
  return Object.assign(new Media(), {
    id,
    kind,
    storageKey: `uploads/${kind}/${id}.${ext}`,
    mimeType: `mime/${kind}`,
    sizeBytes: '1234',
    checksumSha256: 'f'.repeat(64),
    processingState: MediaProcessingState.READY,
    isDeleted: false,
    source: 'Nguồn',
    author: 'Tác giả',
    license: 'CC BY 4.0',
    createdById: 'u1',
    originalName: 'goc.png',
    ...overrides,
  });
}

function hotspot(overrides: Partial<Hotspot> = {}): Hotspot {
  return Object.assign(new Hotspot(), {
    id: 'h1', label: 'Nhãn', body: 'Nội dung', positionX: '1', positionY: '2', positionZ: '3', displayOrder: 1, ...overrides,
  });
}

function revision(overrides: Partial<ExhibitRevision> = {}, content: Record<string, unknown> = {}): ExhibitRevision {
  return Object.assign(new ExhibitRevision(), {
    id: REVISION_ID,
    exhibitId: EXHIBIT_ID,
    revisionNo: 1,
    state: RevisionState.APPROVED,
    content: {
      name: { vi: 'Bình', en: 'Vase' },
      description: { vi: 'Mô tả', en: 'Description' },
      transcript: { vi: 'Thuyết minh', en: 'Narration' },
      altText: { vi: 'Ảnh', en: 'Photo' },
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0.1, y: 0.2, z: 0.3 },
      scale: { x: 2, y: 2, z: 2 },
      placeholderShape: 'sphere',
      placeholderColor: '#123456',
      ...content,
    } as unknown as ExhibitRevisionContent,
    hotspots: [],
    modelMedia: null, imageMedia: null, audioMedia: null, audioEnMedia: null, subtitleViMedia: null, subtitleEnMedia: null,
    ...overrides,
  });
}

function exhibit(rev: ExhibitRevision | null, overrides: Partial<Exhibit> = {}): Exhibit {
  return Object.assign(new Exhibit(), {
    id: EXHIBIT_ID, roomId: 'r1', displayOrder: 2, visibility: ExhibitVisibility.VISIBLE,
    publishedRevision: rev, publishedRevisionId: rev?.id ?? null, ...overrides,
  });
}

describe('toPublicExhibit', () => {
  it('không có revision published / revision không APPROVED / id lệch → null', () => {
    assert.equal(toPublicExhibit(exhibit(null), url), null);
    for (const state of [RevisionState.DRAFT, RevisionState.IN_REVIEW, RevisionState.REJECTED]) {
      assert.equal(toPublicExhibit(exhibit(revision({ state })), url), null, state);
    }
    assert.equal(toPublicExhibit(exhibit(revision(), { publishedRevisionId: 'khac' }), url), null);
  });

  it('nội dung song ngữ: field cũ là bản vi + i18n đủ', () => {
    const dto = toPublicExhibit(exhibit(revision()), url)!;
    assert.equal(dto.name, 'Bình');
    assert.equal(dto.description, 'Mô tả');
    assert.equal(dto.transcript, 'Thuyết minh');
    assert.deepEqual(dto.i18n, {
      vi: { name: 'Bình', description: 'Mô tả', transcript: 'Thuyết minh' },
      en: { name: 'Vase', description: 'Description', transcript: 'Narration' },
    });
  });

  it('nội dung chuỗi thường (seed) vẫn hoạt động; thiếu vi thì dùng en', () => {
    const fromSeed = toPublicExhibit(exhibit(revision({}, { name: 'Mũ', description: 'Mô tả', transcript: null })), url)!;
    assert.equal(fromSeed.name, 'Mũ');
    assert.equal(fromSeed.i18n.en.name, null);
    assert.equal(fromSeed.transcript, null);
    assert.equal(toPublicExhibit(exhibit(revision({}, { name: { en: 'Only EN' } })), url)!.name, 'Only EN');
  });

  it('transform: position/rotation/scale; giá trị hỏng → mặc định an toàn', () => {
    const dto = toPublicExhibit(exhibit(revision()), url)!;
    assert.deepEqual([dto.positionX, dto.positionY, dto.positionZ], [1, 2, 3]);
    assert.deepEqual(dto.rotation, { x: 0.1, y: 0.2, z: 0.3 });
    assert.deepEqual(dto.scale, { x: 2, y: 2, z: 2 });
    const broken = toPublicExhibit(exhibit(revision({}, { position: { x: 'abc', y: null }, rotation: undefined, scale: { x: 0, y: -1, z: Infinity } })), url)!;
    assert.deepEqual([broken.positionX, broken.positionY, broken.positionZ], [0, 0, 0]);
    assert.deepEqual(broken.rotation, { x: 0, y: 0, z: 0 });
    assert.deepEqual(broken.scale, { x: 1, y: 1, z: 1 });
  });

  it('placeholder không hợp lệ → mặc định box/#8b7355', () => {
    const dto = toPublicExhibit(exhibit(revision({}, { placeholderShape: 'pyramid', placeholderColor: 'red' })), url)!;
    assert.equal(dto.placeholderShape, 'box');
    assert.equal(dto.placeholderColor, '#8b7355');
  });

  it('hotspot: chuỗi JSON song ngữ, sắp theo displayOrder rồi id, loại tọa độ không hữu hạn', () => {
    const dto = toPublicExhibit(exhibit(revision({
      hotspots: [
        hotspot({ id: 'b', displayOrder: 2, label: '{"vi":"Miệng","en":"Rim"}' }),
        hotspot({ id: 'a', displayOrder: 2 }),
        hotspot({ id: 'c', displayOrder: 1 }),
        hotspot({ id: 'nan', displayOrder: 0, positionX: 'NaN' }),
        hotspot({ id: 'empty', displayOrder: 0, positionY: '' }),
      ],
    })), url)!;
    assert.deepEqual(dto.hotspots.map((h) => h.id), ['c', 'a', 'b']);
    const rim = dto.hotspots.find((h) => h.id === 'b')!;
    assert.equal(rim.label, 'Miệng');
    assert.deepEqual(rim.i18n.en, { label: 'Rim', body: null });
    assert.deepEqual([rim.positionX, rim.positionY, rim.positionZ], [1, 2, 3]);
  });

  it('media đủ 6 slot: URL tuyệt đối, rights, alt text; không lộ storageKey/checksum/người tạo', () => {
    const dto = toPublicExhibit(exhibit(revision({
      modelMedia: media(MediaKind.MODEL, 'm'),
      imageMedia: media(MediaKind.IMAGE, 'i'),
      audioMedia: media(MediaKind.AUDIO, 'av'),
      audioEnMedia: media(MediaKind.AUDIO, 'ae'),
      subtitleViMedia: media(MediaKind.SUBTITLE, 'sv'),
      subtitleEnMedia: media(MediaKind.SUBTITLE, 'se'),
    })), url)!;
    assert.deepEqual(dto.model, {
      id: 'm', url: 'http://api.test/media/uploads/model/m.glb', mimeType: 'mime/model', sizeBytes: 1234,
      rights: { source: 'Nguồn', author: 'Tác giả', license: 'CC BY 4.0' },
    });
    assert.deepEqual(dto.image?.altText, { vi: 'Ảnh', en: 'Photo' });
    assert.equal(dto.audio?.vi?.audio.id, 'av');
    assert.equal(dto.audio?.vi?.subtitle?.id, 'sv');
    assert.equal(dto.audio?.vi?.transcript, 'Thuyết minh');
    assert.equal(dto.audio?.en?.audio.id, 'ae');
    assert.equal(dto.audio?.en?.subtitle?.id, 'se');
    assert.equal(dto.audio?.en?.transcript, 'Narration');
    const json = JSON.stringify(dto);
    for (const secret of ['storageKey', 'checksum', 'createdById', 'originalName', 'goc.png', REVISION_ID]) {
      assert.equal(json.includes(secret), false, secret);
    }
  });

  it('chỉ audio en → audio.vi = null (không tự thay ngôn ngữ — AC-08)', () => {
    const dto = toPublicExhibit(exhibit(revision({ audioEnMedia: media(MediaKind.AUDIO, 'ae') })), url)!;
    assert.equal(dto.audio?.vi, null);
    assert.equal(dto.audio?.en?.audio.id, 'ae');
    assert.equal(dto.audio?.en?.subtitle, null);
  });

  it('không có audio → audio = null', () => {
    assert.equal(toPublicExhibit(exhibit(revision()), url)!.audio, null);
  });

  it('media đã xóa / không ready / sai kind / không có URL → null + báo skip, exhibit vẫn trả', () => {
    const skipped: string[] = [];
    const dto = toPublicExhibit(exhibit(revision({
      modelMedia: media(MediaKind.MODEL, 'deleted', { isDeleted: true }),
      imageMedia: media(MediaKind.IMAGE, 'failed', { processingState: MediaProcessingState.FAILED }),
      audioMedia: media(MediaKind.SUBTITLE, 'wrong-kind'),
      audioEnMedia: media(MediaKind.AUDIO, 'quarantine', { storageKey: 'quarantine/x.bin' }),
    })), url, (_exhibitId, mediaId) => skipped.push(mediaId))!;
    assert.equal(dto.model, null);
    assert.equal(dto.image, null);
    assert.equal(dto.audio, null);
    assert.deepEqual(skipped.sort(), ['deleted', 'failed', 'quarantine', 'wrong-kind']);
  });

  it('audio hỏng thì cả track bị bỏ (không trả phụ đề mồ côi)', () => {
    const dto = toPublicExhibit(exhibit(revision({
      audioMedia: media(MediaKind.AUDIO, 'av', { isDeleted: true }),
      subtitleViMedia: media(MediaKind.SUBTITLE, 'sv'),
    })), url)!;
    assert.equal(dto.audio, null);
  });
});

describe('toAdminRevision', () => {
  const creator = Object.assign(new User(), { id: 'u1', displayName: 'Editor', email: 'e@x.test', passwordHash: '$2a$12$secret' });

  it('không lộ passwordHash hay storageKey/checksum', () => {
    const dto = toAdminRevision(revision({ createdBy: creator, reviewedBy: creator, modelMedia: media(MediaKind.MODEL, 'm') }), signed);
    const json = JSON.stringify(dto);
    for (const secret of ['passwordHash', '$2a$12$secret', 'storageKey', 'ffffffff']) {
      assert.equal(json.includes(secret), false, secret);
    }
    assert.deepEqual(dto.createdBy, { id: 'u1', name: 'Editor', email: 'e@x.test' });
  });

  it('media của revision: URL ký; media xóa/không ready → url null nhưng vẫn hiển thị', () => {
    const dto = toAdminRevision(revision({
      modelMedia: media(MediaKind.MODEL, 'm'),
      imageMedia: media(MediaKind.IMAGE, 'i', { isDeleted: true }),
      audioMedia: media(MediaKind.AUDIO, 'a', { processingState: MediaProcessingState.PENDING }),
    }), signed);
    assert.equal(dto.media.model?.url, signed('uploads/model/m.glb'));
    assert.equal(dto.media.image?.url, null);
    assert.equal(dto.media.image?.isDeleted, true);
    assert.equal(dto.media.audioVi?.url, null);
    assert.equal(dto.media.subtitleEn, null);
  });

  it('mediaIds đủ 6 cột; hotspot sắp theo displayOrder với tọa độ số', () => {
    const dto = toAdminRevision(revision({
      audioEnMediaId: 'ae',
      hotspots: [hotspot({ id: 'b', displayOrder: 2 }), hotspot({ id: 'a', displayOrder: 1 })],
    }), signed);
    assert.equal(Object.keys(dto.mediaIds).length, 6);
    assert.equal(dto.mediaIds.audioEnMediaId, 'ae');
    assert.deepEqual(dto.hotspots.map((h) => h.id), ['a', 'b']);
    assert.equal(dto.hotspots[0].positionX, 1);
  });
});
