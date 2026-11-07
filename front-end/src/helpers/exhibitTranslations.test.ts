import { describe, expect, it } from 'vitest';
import { emptyHotspot, resolveTranslations, toHotspotFormValues, toHotspotPayload } from './exhibitHotspots';
import { toExhibitTranslations, translatedField, translationProgress } from './exhibitTranslations';

describe('toExhibitTranslations', () => {
  it('đọc object, chuỗi JSON và dữ liệu cũ; không có thì ô trống', () => {
    const values = toExhibitTranslations({ name: { vi: 'A', ko: '꽃병' }, description: '{"vi":"B","ja":"説明"}', transcript: 'Chuỗi cũ' });
    expect(values.ko.name).toBe('꽃병');
    expect(values.ja.description).toBe('説明');
    expect(values.ko.transcript).toBe('');
    expect(toExhibitTranslations().fr).toEqual({ name: '', description: '', transcript: '', altText: '' });
  });
});

describe('translatedField', () => {
  it('chỉ giữ bản dịch có nội dung, đã trim', () => {
    const values = toExhibitTranslations({ name: { ko: ' 꽃병 ', ja: '   ' } });
    expect(translatedField(values, 'name')).toEqual({ ko: '꽃병' });
  });
});

describe('translationProgress', () => {
  it('đếm cả hotspot theo từng ngôn ngữ', () => {
    const hotspot = emptyHotspot();
    hotspot.translations.ko = { label: '입구', body: '' };
    const values = toExhibitTranslations({ name: { ko: '꽃병' } });
    expect(translationProgress(values, [hotspot], 'ko')).toEqual({ done: 2, total: 6 });
    expect(translationProgress(values, [], 'ja')).toEqual({ done: 0, total: 4 });
  });
});

describe('bản dịch hotspot', () => {
  it('đọc và gửi lại đủ bản dịch, bỏ ô trống', () => {
    const [value] = toHotspotFormValues([{
      id: 'h', label: '{"vi":"Miệng","en":"Rim","ko":"입구"}', body: '{"vi":"Thân","en":"Body"}',
      position: { x: 1, y: 2, z: 3 }, displayOrder: 1,
    }] as never);
    expect(value.translations.ko).toEqual({ label: '입구', body: '' });
    const [payload] = toHotspotPayload([value]);
    expect(payload.label).toEqual({ vi: 'Miệng', en: 'Rim', ko: '입구' });
    expect(payload.body).toEqual({ vi: 'Thân', en: 'Body' });
  });

  it('resolveTranslations nhận chuỗi JSON chỉ có bản dịch mới', () => {
    expect(resolveTranslations('{"ko":"입구"}').ko).toBe('입구');
    expect(resolveTranslations('Chuỗi thường').ko).toBe('');
  });
});
