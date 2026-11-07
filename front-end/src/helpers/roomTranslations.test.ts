import { describe, expect, it } from 'vitest';
import { toRoomTranslationsInput, toRoomTranslationValues } from './roomTranslations';

describe('bản dịch phòng trong form', () => {
  it('đọc và gửi lại, bỏ ô trống và trim', () => {
    const values = toRoomTranslationValues({ name: { ko: ' 도자기실 ', en: '  ' }, description: { ja: '説明' } });
    expect(values.ko).toEqual({ name: ' 도자기실 ', description: '' });
    expect(toRoomTranslationsInput(values)).toEqual({ name: { ko: '도자기실' }, description: { ja: '説明' } });
  });

  it('phòng cũ chưa có bản dịch thì toàn ô trống', () => {
    expect(toRoomTranslationValues(undefined).fr).toEqual({ name: '', description: '' });
    expect(toRoomTranslationsInput(toRoomTranslationValues())).toEqual({ name: {}, description: {} });
  });
});
