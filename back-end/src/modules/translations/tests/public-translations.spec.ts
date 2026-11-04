import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import { PublicTranslationsController } from '../controllers/public-translations.controller';
import type { Translation, TranslationCategory } from '../entities/translation.entity';
import { TranslationsRepository } from '../repositories/translations.repository';
import { TranslationsService } from '../services/translations.service';

const ROWS = [
  { namespace: 'ui.nav.home', category: 'ui', values: { vi: 'Trang chủ', en: 'Home', fr: '' } },
  { namespace: 'ui.nav.tour', category: 'ui', values: { vi: 'Tham quan 3D' } },
  { namespace: 'exhibit.chua-duyet.name', category: 'exhibit', values: { vi: 'Bản nháp bí mật', en: 'Secret draft' } },
  { namespace: 'room.moi.name', category: 'room', values: { en: 'Unpublished room' } },
] as unknown as Translation[];

describe('GET /public/translations', () => {
  let app: INestApplication;
  const categories: TranslationCategory[] = [];

  before(async () => {
    const repo = {
      listByCategory: async (category: TranslationCategory) => {
        categories.push(category);
        return ROWS.filter((row) => row.category === category);
      },
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [PublicTranslationsController],
      providers: [TranslationsService, { provide: TranslationsRepository, useValue: repo }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });
  after(async () => { await app?.close(); });

  it('trả { namespace: text } của ngôn ngữ, bỏ chuỗi chưa dịch hoặc rỗng', async () => {
    const res = await request(app.getHttpServer()).get('/public/translations?locale=en').expect(200);
    assert.deepEqual(res.body.data, { 'ui.nav.home': 'Home' });
    assert.equal(res.headers['cache-control'], 'no-cache');
    assert.deepEqual((await request(app.getHttpServer()).get('/public/translations?locale=fr').expect(200)).body.data, {});
  });

  it('CHỈ loại ui: chuỗi exhibit/room (có thể chưa duyệt) không bao giờ lộ', async () => {
    const res = await request(app.getHttpServer()).get('/public/translations?locale=en').expect(200);
    assert.equal(JSON.stringify(res.body).includes('Secret draft'), false);
    assert.equal(JSON.stringify(res.body).includes('Unpublished room'), false);
    assert.ok(categories.every((category) => category === 'ui'));
  });

  it('ngôn ngữ không hỗ trợ hoặc thiếu → 400', async () => {
    await request(app.getHttpServer()).get('/public/translations?locale=xx').expect(400);
    await request(app.getHttpServer()).get('/public/translations').expect(400);
  });

  it('route công khai (@Public), khách không cần đăng nhập', () => {
    assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, PublicTranslationsController.prototype.list), true);
  });
});
