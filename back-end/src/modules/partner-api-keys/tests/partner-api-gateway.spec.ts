import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import { appConfig, jwtConfig } from '../../../config';
import { ActiveSessionGuard } from '../../auth/guards/active-session.guard';
import { RefreshSessionsRepository } from '../../auth/repositories/refresh-sessions.repository';
import { ExhibitsService } from '../../exhibits/services/exhibits.service';
import { PublicModelsService } from '../../exhibits/services/public-models.service';
import { PartnerApiController } from '../controllers/partner-api.controller';
import type { PartnerApiKey } from '../entities/partner-api-key.entity';
import { PartnerApiKeyGuard } from '../guards/partner-api-key.guard';
import { PartnerApiKeysService } from '../services/partner-api-keys.service';
import { PartnerRateLimiter } from '../services/partner-rate-limiter.service';

const KEYS: Record<string, Partial<PartnerApiKey>> = {
  'ak_live_rooms': { id: 'k-rooms', partnerName: 'A', scopes: ['rooms:read'], rateLimitPerMinute: 100 },
  'ak_live_public': { id: 'k-public', partnerName: 'B', scopes: ['public:read'], rateLimitPerMinute: 100 },
  'ak_live_tight': { id: 'k-tight', partnerName: 'C', scopes: ['public:read'], rateLimitPerMinute: 2 },
};
const ROOM = {
  id: 'r1', slug: 'phong-gom', name: 'Phòng Gốm', description: null,
  exhibits: [
    { id: 'e2', displayOrder: 2, name: 'Bình', i18n: { vi: { name: 'Bình' }, en: { name: 'Vase' } } },
    { id: 'e1', displayOrder: 1, name: 'Chum', i18n: { vi: { name: 'Chum' }, en: { name: 'Jar' } } },
  ],
};

describe('Cổng API đối tác /partner/v1 (guard API key + scope + rate limit)', () => {
  let app: INestApplication;
  const used: string[] = [];

  before(async () => {
    process.env.JWT_ACCESS_SECRET = 'partner-gateway-spec-secret-0123456789';
    const keys = {
      authenticate: async (plaintext: string) => (KEYS[plaintext] ?? null) as PartnerApiKey | null,
      recordUse: async (key: PartnerApiKey) => void used.push(key.id),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [appConfig, jwtConfig] }), JwtModule.register({})],
      controllers: [PartnerApiController],
      providers: [
        // Guard toàn cục của admin như AppModule: route đối tác phải đi qua được mà không cần JWT.
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: ActiveSessionGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
        { provide: RefreshSessionsRepository, useValue: { isFamilyLive: async () => false } },
        { provide: PartnerApiKeysService, useValue: keys },
        PartnerRateLimiter,
        PartnerApiKeyGuard,
        { provide: ExhibitsService, useValue: { roomsList: async () => [{ slug: 'phong-gom' }], roomWithExhibits: async () => ROOM } },
        { provide: PublicModelsService, useValue: {} },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  after(async () => {
    await app?.close();
  });

  const get = (path: string, key?: string) => {
    const req = request(app.getHttpServer()).get(`/partner/v1${path}`);
    return key ? req.set('X-API-Key', key) : req;
  };

  it('401 khi thiếu key hoặc key sai/đã thu hồi/hết hạn (service trả null)', async () => {
    await get('/rooms').expect(401);
    const res = await get('/rooms', 'ak_live_khong-ton-tai').expect(401);
    assert.equal(res.body.success, false);
  });

  it('key hợp lệ đi qua được dù không có JWT; trả header rate limit và ghi lần dùng', async () => {
    used.length = 0;
    const res = await get('/rooms', 'ak_live_rooms').expect(200);
    assert.deepEqual(res.body.data, [{ slug: 'phong-gom' }]);
    assert.equal(res.headers['x-ratelimit-limit'], '100');
    assert.equal(res.headers['x-ratelimit-remaining'], '99');
    assert.deepEqual(used, ['k-rooms']);
  });

  it('403 khi key thiếu scope của route; public:read dùng được mọi route đọc', async () => {
    await get('/rooms/phong-gom', 'ak_live_rooms').expect(403);
    await get('/rooms/phong-gom/tour', 'ak_live_rooms').expect(403);
    await get('/rooms/phong-gom', 'ak_live_public').expect(200);
  });

  it('tour: danh sách điểm dừng gọn, sắp theo displayOrder', async () => {
    const res = await get('/rooms/phong-gom/tour', 'ak_live_public').expect(200);
    assert.deepEqual(res.body.data.room, { id: 'r1', slug: 'phong-gom', name: 'Phòng Gốm' });
    assert.deepEqual(res.body.data.stops.map((s: { exhibitId: string }) => s.exhibitId), ['e1', 'e2']);
  });

  it('429 + Retry-After khi vượt giới hạn của key; key khác không bị ảnh hưởng', async () => {
    await get('/rooms', 'ak_live_tight').expect(200);
    await get('/rooms', 'ak_live_tight').expect(200);
    const res = await get('/rooms', 'ak_live_tight').expect(429);
    assert.ok(Number(res.headers['retry-after']) >= 1);
    assert.equal(res.headers['x-ratelimit-remaining'], '0');
    await get('/rooms', 'ak_live_public').expect(200);
  });
});
