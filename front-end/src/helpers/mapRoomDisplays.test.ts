import { expect, it } from 'vitest';
import { roomDetailSchema } from '@/validations/roomSchema';
import { publicRoomWithMediaResponse } from '../../tests/fixtures/publicRoomWithMedia';
import { mapRoomDisplays } from './mapRoomDisplays';

it('maps only the Vietnamese track and transcript, never an English fallback', () => {
  const room = roomDetailSchema.parse(publicRoomWithMediaResponse.data);
  const display = mapRoomDisplays(room)[0];
  expect(display.audio?.audio.url).toContain('/98d6467e-');
  expect(display.audioLocale).toBe('vi');
  room.exhibits[0].audio!.vi = null;
  room.exhibits[0].i18n!.vi.transcript = null;
  room.exhibits[0].transcript = 'English legacy text';
  expect(mapRoomDisplays(room)[0].audio).toBeNull();
  expect(mapRoomDisplays(room)[0].transcript).toBeNull();
});
