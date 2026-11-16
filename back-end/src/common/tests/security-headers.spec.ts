import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Controller, Get, Header, INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import helmet from 'helmet';
import request from 'supertest';
import { SECURITY_HEADERS } from '../security/security-headers';

@Controller()
class ProbeController {
  @Get('ok')
  ok() { return { ok: true }; }

  @Get('missing')
  missing() { throw new NotFoundException(); }

  /** Giống MediaDeliveryController: route tự đặt CSP/CORP chặt hơn. */
  @Get('media')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  media() { return 'file'; }
}

describe('Header bảo mật (helmet)', () => {
  let app: INestApplication;

  before(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
    app = moduleRef.createNestApplication();
    app.use(helmet(SECURITY_HEADERS));
    await app.init();
  });
  after(async () => { await app?.close(); });

  it('có các header chính, ẩn X-Powered-By, CORP cho phép front-end khác site', async () => {
    const { headers } = await request(app.getHttpServer()).get('/ok').expect(200);
    assert.equal(headers['x-content-type-options'], 'nosniff');
    assert.equal(headers['x-frame-options'], 'SAMEORIGIN');
    assert.match(headers['strict-transport-security'], /max-age=/);
    assert.match(headers['content-security-policy'], /default-src 'self'/);
    assert.equal(headers['cross-origin-resource-policy'], 'cross-origin');
    assert.equal(headers['x-powered-by'], undefined);
  });

  it('response lỗi cũng có header; route tự đặt CSP được giữ nguyên', async () => {
    const { headers: notFound } = await request(app.getHttpServer()).get('/missing').expect(404);
    assert.equal(notFound['x-content-type-options'], 'nosniff');
    const { headers: media } = await request(app.getHttpServer()).get('/media').expect(200);
    assert.equal(media['content-security-policy'], "default-src 'none'; sandbox");
  });
});
