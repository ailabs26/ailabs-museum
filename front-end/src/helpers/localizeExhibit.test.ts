import { describe, expect, it } from 'vitest';
import { hasTranslation, localizedAltText, localizedTranscript, localizeExhibit } from './localizeExhibit';

const exhibit = {
  name: 'Trống đồng', description: 'Mô tả',
  i18n: { vi: { name: 'Trống đồng', description: 'Mô tả' }, en: { name: 'Bronze drum', description: null } },
};

describe('localizeExhibit', () => {
  it('en dùng bản tiếng Anh, trường trống giữ nội dung gốc; ngôn ngữ khác hoặc không có i18n giữ nguyên', () => {
    expect(localizeExhibit(exhibit, 'en')).toMatchObject({ name: 'Bronze drum', description: 'Mô tả' });
    expect(localizeExhibit(exhibit, 'vi')).toBe(exhibit);
    expect(localizeExhibit(exhibit, 'ja')).toBe(exhibit);
    const plain = { name: 'A', description: 'B' };
    expect(localizeExhibit(plain, 'en')).toBe(plain);
  });

  it('ngôn ngữ mới: dùng bản dịch, ô trống về nội dung gốc; hotspot dịch riêng từng mục', () => {
    const translated = {
      ...exhibit,
      i18n: { ...exhibit.i18n, ko: { name: '청동 북', description: '' } },
      hotspots: [
        { label: 'Mặt', body: 'Thân', i18n: { ko: { label: '면', body: null } } },
        { label: 'Quai', body: 'Mô tả quai' },
      ],
    };
    const result = localizeExhibit(translated, 'ko');
    expect(result).toMatchObject({ name: '청동 북', description: 'Mô tả' });
    expect(result.hotspots.map(({ label, body }) => [label, body])).toEqual([['면', 'Thân'], ['Quai', 'Mô tả quai']]);
  });

  it('chỉ hotspot có bản dịch vẫn được áp dụng', () => {
    const onlyHotspot = { name: 'A', description: 'B', hotspots: [{ label: 'Mặt', body: 'Thân', i18n: { ja: { label: '面', body: '胴' } } }] };
    expect(localizeExhibit(onlyHotspot, 'ja').hotspots[0]).toMatchObject({ label: '面', body: '胴' });
    expect(localizeExhibit(onlyHotspot, 'fr')).toBe(onlyHotspot);
  });
});

describe('localizedTranscript', () => {
  const copy = { name: null, description: null };
  it('bản dịch → lời của audio tiếng Việt → bản tiếng Việt → dữ liệu cũ', () => {
    const i18n = { vi: { ...copy, transcript: 'Việt' }, ko: { ...copy, transcript: '한국어' } };
    expect(localizedTranscript({ i18n, audio: { vi: { transcript: 'Audio' } } }, 'ko')).toBe('한국어');
    expect(localizedTranscript({ i18n, audio: { vi: { transcript: 'Audio' } } }, 'ja')).toBe('Audio');
    expect(localizedTranscript({ i18n }, 'ja')).toBe('Việt');
    expect(localizedTranscript({ transcript: 'Cũ' }, 'ja')).toBe('Cũ');
    expect(localizedTranscript({}, 'ja')).toBeNull();
  });
});

describe('localizedAltText và hasTranslation', () => {
  it('alt text: bản dịch → tiếng Việt → tên hiện vật', () => {
    expect(localizedAltText({ vi: 'Ảnh', ja: '写真' }, 'ja', 'Tên')).toBe('写真');
    expect(localizedAltText({ vi: 'Ảnh', ja: null }, 'ja', 'Tên')).toBe('Ảnh');
    expect(localizedAltText({ vi: null }, 'ja', 'Tên')).toBe('Tên');
  });

  it('tiếng Việt luôn coi là có; ngôn ngữ khác phải có tên đã dịch', () => {
    const i18n = { ko: { name: '북', description: null }, ja: { name: null, description: null } };
    expect(hasTranslation({}, 'vi')).toBe(true);
    expect(hasTranslation({ i18n }, 'ko')).toBe(true);
    expect(hasTranslation({ i18n }, 'ja')).toBe(false);
  });
});
