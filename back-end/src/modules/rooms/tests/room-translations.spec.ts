import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateRoomDto } from '../dto/update-room.dto';
import { sanitizeRoomTranslations, toPublicRoomText } from '../utils/room-translations';

const room = {
  name: 'Phòng gốm',
  description: 'Mô tả',
  translations: { name: { en: 'Ceramics', ko: '도자기실' }, description: { en: 'About' } },
};

describe('sanitizeRoomTranslations', () => {
  it('bỏ vi, bỏ ô trống và trim', () => {
    assert.deepEqual(
      sanitizeRoomTranslations({ name: { vi: 'Bỏ', en: ' Ceramics ', ko: '  ' }, description: undefined }),
      { name: { en: 'Ceramics' }, description: {} },
    );
    assert.deepEqual(sanitizeRoomTranslations(undefined), { name: {}, description: {} });
  });
});

describe('toPublicRoomText', () => {
  it('không có lang: tiếng Việt như cũ, không có contentLocale; i18n đủ ngôn ngữ', () => {
    const text = toPublicRoomText(room);
    assert.equal(text.name, 'Phòng gốm');
    assert.equal(text.description, 'Mô tả');
    assert.equal('contentLocale' in text, false);
    assert.deepEqual(text.i18n.ko, { name: '도자기실', description: null });
    assert.deepEqual(text.i18n.vi, { name: 'Phòng gốm', description: 'Mô tả' });
  });

  it('có lang: theo ngôn ngữ, thiếu thì về tiếng Việt và báo ngôn ngữ thật', () => {
    const ko = toPublicRoomText(room, 'ko');
    assert.deepEqual([ko.name, ko.description, ko.contentLocale], ['도자기실', 'Mô tả', 'ko']);
    const ja = toPublicRoomText(room, 'ja');
    assert.deepEqual([ja.name, ja.contentLocale], ['Phòng gốm', 'vi']);
  });

  it('dữ liệu cũ không có translations và mô tả null vẫn chạy', () => {
    const text = toPublicRoomText({ name: 'A', description: null, translations: undefined as never }, 'en');
    assert.deepEqual([text.name, text.description, text.contentLocale], ['A', null, 'vi']);
  });
});

describe('UpdateRoomDto.translations', () => {
  const errorsOf = async (plain: object) => (await validate(plainToInstance(UpdateRoomDto, plain))).map((error) => error.property);

  it('nhận bản dịch hợp lệ, chặn tên quá dài', async () => {
    assert.deepEqual(await errorsOf({ translations: { name: { ko: '도자기실' }, description: { ja: '説明' } } }), []);
    assert.deepEqual(await errorsOf({ translations: { name: { ko: 'x'.repeat(201) } } }), ['translations']);
  });
});
