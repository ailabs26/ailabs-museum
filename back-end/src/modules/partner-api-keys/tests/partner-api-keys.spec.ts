import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import {
  ConflictException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import { appConfig, jwtConfig } from '../../../config';
import { PartnerApiKeysController } from '../controllers/partner-api-keys.controller';
import { PartnerApiKey } from '../entities/partner-api-key.entity';
import { PartnerApiKeysRepository } from '../repositories/partner-api-keys.repository';
import { PartnerApiKeysService } from '../services/partner-api-keys.service';

const SECRET = 'partner-apikeys-spec-jwt-secret-012345';
const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const KEY_ID = '33333333-3333-4333-8333-333333333333';
const MISSING_ID = '99999999-9999-4999-8999-999999999999';

function createInMemoryPartnerKeysRepo() {
  const store = new Map<string, PartnerApiKey>();
  const touchedIds: string[] = [];

  return {
    store,
    touchedIds,
    listAll: async () =>
      [...store.values()].filter((entity) => !entity.isDeleted),
    findById: async (id: string) => {
      const entity = store.get(id);
      return entity && !entity.isDeleted ? entity : null;
    },
    existsByHash: async (keyHash: string) =>
      [...store.values()].some((entity) => entity.keyHash === keyHash),
    findUsableByHash: async (keyHash: string, now = new Date()) => {
      for (const entity of store.values()) {
        if (entity.keyHash !== keyHash) continue;
        if (entity.isDeleted || entity.status !== 'active') return null;
        if (entity.expiresAt && entity.expiresAt.getTime() <= now.getTime()) {
          return null;
        }
        return entity;
      }
      return null;
    },
    touchLastUsed: async (id: string, at: Date) => {
      touchedIds.push(id);
      const entity = store.get(id);
      if (entity) entity.lastUsedAt = at;
    },
    create: (data: Partial<PartnerApiKey>) =>
      Object.assign(new PartnerApiKey(), {
        id: KEY_ID,
        createdAt: new Date('2026-10-25T08:00:00.000Z'),
        updatedAt: new Date('2026-10-25T08:00:00.000Z'),
        isDeleted: false,
        deletedAt: null,
        ...data,
      }),
    save: async (entity: PartnerApiKey) => {
      store.set(entity.id, entity);
      return entity;
    },
  };
}

describe('PartnerApiKeysService — bảo mật khóa, hết hạn & thu hồi (#110, #113)', () => {
  it('create() chỉ lưu SHA-256 hash vào DB và trả plaintext duy nhất một lần', async () => {
    const repo = createInMemoryPartnerKeysRepo();
    const service = new PartnerApiKeysService(
      repo as unknown as PartnerApiKeysRepository,
    );
    const result = await service.create({
      partnerName: 'VietnamPlus',
      label: 'Test key',
      scopes: ['public:read', 'exhibits:read'],
      expiresInDays: 30,
    });

    assert.match(result.plaintext, /^ak_live_[0-9a-f]{48}$/);
    const saved = repo.store.get(KEY_ID)!;
    assert.equal(
      saved.keyHash,
      createHash('sha256').update(result.plaintext).digest('hex'),
    );
    assert.equal(saved.keyHash.length, 64);
    assert.ok(!saved.keyHash.includes(result.plaintext));
    assert.equal(saved.last4, result.plaintext.slice(-4));
    assert.equal(result.maskedKey, `ak_live_••••${saved.last4}`);
    assert.equal('keyHash' in result, false);
  });

  it('authenticate() chấp nhận khóa active còn hạn và từ chối khóa sai prefix, hết hạn, đã thu hồi hoặc đã xóa mềm', async () => {
    const repo = createInMemoryPartnerKeysRepo();
    const service = new PartnerApiKeysService(
      repo as unknown as PartnerApiKeysRepository,
    );

    const { plaintext } = await service.create({
      partnerName: 'EduPartner',
      label: 'Production key',
      scopes: ['public:read'],
      expiresInDays: 10,
    });

    // 1. Sai prefix hoặc rỗng -> null
    assert.equal(await service.authenticate(''), null);
    assert.equal(await service.authenticate('bearer_wrong_prefix'), null);
    assert.equal(await service.authenticate('ak_live_unknown_token'), null);

    // 2. Khóa hợp lệ, đang active và chưa hết hạn -> trả entity & recordUse cập nhật lastUsedAt
    const authenticated = await service.authenticate(plaintext);
    assert.ok(authenticated);
    assert.equal(authenticated.id, KEY_ID);
    await service.recordUse(authenticated);
    assert.equal(repo.touchedIds.length, 1);

    // 3. Khóa đã hết hạn (expiresAt <= now) -> bị từ chối (null)
    const entity = repo.store.get(KEY_ID)!;
    entity.expiresAt = new Date(Date.now() - 60_000);
    assert.equal(await service.authenticate(plaintext), null);

    // 4. Khôi phục hạn nhưng thu hồi khóa -> bị từ chối (null)
    entity.expiresAt = new Date(Date.now() + 86_400_000);
    await service.revoke(KEY_ID);
    assert.equal(await service.authenticate(plaintext), null);

    // 5. Thu hồi lần 2 -> 409 ConflictException
    await assert.rejects(
      () => service.revoke(KEY_ID),
      (err: unknown) =>
        err instanceof ConflictException &&
        /đã bị thu hồi/.test(err.message),
    );

    // 6. Xóa mềm khóa -> authenticate và findById đều không còn hiệu lực
    entity.status = 'active';
    await service.remove(KEY_ID);
    assert.equal(await service.authenticate(plaintext), null);
    assert.equal((await service.list()).length, 0);

    await assert.rejects(
      () => service.revoke(MISSING_ID),
      (err: unknown) => err instanceof NotFoundException,
    );
    await assert.rejects(
      () => service.remove(MISSING_ID),
      (err: unknown) => err instanceof NotFoundException,
    );
  });
});

describe('PartnerApiKeysController — HTTP RBAC & DTO Validation (#111, #113)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const repo = createInMemoryPartnerKeysRepo();
  const previousSecret = process.env.JWT_ACCESS_SECRET;

  function signToken(permissions: readonly string[]) {
    return jwt.signAsync(
      {
        sub: ACTOR_ID,
        email: 'admin@aura.local',
        displayName: 'Admin',
        roles: [],
        permissions,
      },
      { secret: SECRET, expiresIn: '5m' },
    );
  }

  before(async () => {
    process.env.JWT_ACCESS_SECRET = SECRET;
    const { Test } = await import('@nestjs/testing');
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [appConfig, jwtConfig],
        }),
        JwtModule.register({}),
      ],
      controllers: [PartnerApiKeysController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
        PartnerApiKeysService,
        { provide: PartnerApiKeysRepository, useValue: repo },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    jwt = app.get(JwtService);
  });

  after(async () => {
    await app?.close();
    if (previousSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = previousSecret;
  });

  it('chặn 401 khi không có JWT và chặn 403 khi chỉ có quyền user:* (không cho phép fallback)', async () => {
    const server = app.getHttpServer();
    await request(server).get('/partner-api-keys').expect(401);

    const userOnlyToken = await signToken([
      PERMISSIONS.USER_READ,
      PERMISSIONS.USER_CREATE,
    ]);
    await request(server)
      .get('/partner-api-keys')
      .set('Authorization', `Bearer ${userOnlyToken}`)
      .expect(403);

    await request(server)
      .post('/partner-api-keys')
      .set('Authorization', `Bearer ${userOnlyToken}`)
      .send({
        partnerName: 'Partner A',
        label: 'Key A',
        scopes: ['public:read'],
      })
      .expect(403);
  });

  it('cho phép GET với apikey:read nhưng chặn POST/revoke/DELETE nếu thiếu apikey:manage', async () => {
    const server = app.getHttpServer();
    const readOnlyToken = await signToken([PERMISSIONS.APIKEY_READ]);

    await request(server)
      .get('/partner-api-keys')
      .set('Authorization', `Bearer ${readOnlyToken}`)
      .expect(200);

    await request(server)
      .post('/partner-api-keys')
      .set('Authorization', `Bearer ${readOnlyToken}`)
      .send({
        partnerName: 'Partner A',
        label: 'Key A',
        scopes: ['public:read'],
      })
      .expect(403);

    await request(server)
      .post(`/partner-api-keys/${KEY_ID}/revoke`)
      .set('Authorization', `Bearer ${readOnlyToken}`)
      .expect(403);

    await request(server)
      .delete(`/partner-api-keys/${KEY_ID}`)
      .set('Authorization', `Bearer ${readOnlyToken}`)
      .expect(403);
  });

  it('kiểm tra DTO validation (scopes rỗng/sai/trùng, rateLimit/expiresInDays vượt ngưỡng) và luồng tạo-thu hồi-xóa với apikey:manage', async () => {
    const server = app.getHttpServer();
    const manageToken = await signToken([
      PERMISSIONS.APIKEY_READ,
      PERMISSIONS.APIKEY_MANAGE,
    ]);

    // Scopes rỗng -> 400
    await request(server)
      .post('/partner-api-keys')
      .set('Authorization', `Bearer ${manageToken}`)
      .send({
        partnerName: 'Partner A',
        label: 'Key A',
        scopes: [],
      })
      .expect(400);

    // Scope không hợp lệ -> 400
    await request(server)
      .post('/partner-api-keys')
      .set('Authorization', `Bearer ${manageToken}`)
      .send({
        partnerName: 'Partner A',
        label: 'Key A',
        scopes: ['invalid:scope'],
      })
      .expect(400);

    // Scopes trùng lặp -> 400
    await request(server)
      .post('/partner-api-keys')
      .set('Authorization', `Bearer ${manageToken}`)
      .send({
        partnerName: 'Partner A',
        label: 'Key A',
        scopes: ['public:read', 'public:read'],
      })
      .expect(400);

    // expiresInDays vượt ngưỡng (> 3650) -> 400
    await request(server)
      .post('/partner-api-keys')
      .set('Authorization', `Bearer ${manageToken}`)
      .send({
        partnerName: 'Partner A',
        label: 'Key A',
        scopes: ['public:read'],
        expiresInDays: 5000,
      })
      .expect(400);

    // rateLimitPerMinute < 1 -> 400
    await request(server)
      .post('/partner-api-keys')
      .set('Authorization', `Bearer ${manageToken}`)
      .send({
        partnerName: 'Partner A',
        label: 'Key A',
        scopes: ['public:read'],
        rateLimitPerMinute: 0,
      })
      .expect(400);

    // Tạo key hợp lệ -> 201
    const created = await request(server)
      .post('/partner-api-keys')
      .set('Authorization', `Bearer ${manageToken}`)
      .send({
        partnerName: 'VietnamPlus',
        label: 'Cổng nhúng báo chí',
        scopes: ['public:read', 'exhibits:read'],
        expiresInDays: 90,
        rateLimitPerMinute: 180,
      })
      .expect(201);
    assert.match(created.body.data.plaintext, /^ak_live_[0-9a-f]{48}$/);
    assert.equal(created.body.data.rateLimitPerMinute, 180);

    // Thu hồi key -> 200
    const revoked = await request(server)
      .post(`/partner-api-keys/${KEY_ID}/revoke`)
      .set('Authorization', `Bearer ${manageToken}`)
      .expect(200);
    assert.equal(revoked.body.data.status, 'revoked');

    // Thu hồi lại key đã thu hồi -> 409
    await request(server)
      .post(`/partner-api-keys/${KEY_ID}/revoke`)
      .set('Authorization', `Bearer ${manageToken}`)
      .expect(409);

    // Xóa mềm key -> 204
    await request(server)
      .delete(`/partner-api-keys/${KEY_ID}`)
      .set('Authorization', `Bearer ${manageToken}`)
      .expect(204);
  });
});
