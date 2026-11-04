import { describe, expect, it } from 'vitest';
import { localizeExhibit } from './localizeExhibit';

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
});
