import type { Page } from '@playwright/test';
import { roomDetailSchema } from '../../src/validations/roomSchema';
import { publicRoomWithMediaResponse } from './publicRoomWithMedia';
import { fulfillMuseum } from './museumApi';
import { createWavFixture } from './audioFixture';

export async function installMedia(page: Page, imageMode = 'ok') {
  const room = roomDetailSchema.parse(structuredClone(publicRoomWithMediaResponse.data));
  room.exhibits[0].model = null;
  room.exhibits[0].image!.url = 'http://localhost:3001/media/uploads/images/public.png';
  room.exhibits[0].audio!.vi!.audio.url = 'http://localhost:3001/media/uploads/audio/guide.wav';
  room.exhibits[0].audio!.vi!.subtitle!.url = 'http://localhost:3001/media/uploads/subtitles/guide.vtt';
  await page.route('**/media/uploads/audio/**', route => route.fulfill({ contentType: 'audio/wav', body: createWavFixture(), headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.route('**/media/uploads/subtitles/**', route => route.fulfill({ contentType: 'text/vtt', body: 'WEBVTT\n\n00:00.000 --> 00:08.000\nThuyết minh đồng bộ\n', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.route('**/api/auth/**', route => fulfillMuseum(route, { success: false, data: null, message: 'Unauthenticated' }, 401));
  await page.route('**/api/rooms**', route => fulfillMuseum(route, {
    success: true, message: null, data: new URL(route.request().url()).pathname === '/api/rooms' ? [room] : room,
  }));
  await page.route('**/media/uploads/images/**', route => imageMode === 'ok' || route.request().url().endsWith('/new.png')
    ? route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKn8AAAAASUVORK5CYII=', 'base64') })
    : route.fulfill({ status: 404 }));
  return room;
}
