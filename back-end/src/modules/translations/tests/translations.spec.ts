import 'reflect-metadata';
import assert from 'node:assert/strict';
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
import { TranslationsController } from '../controllers/translations.controller';
import { Translation } from '../entities/translation.entity';
import { TranslationsRepository } from '../repositories/translations.repository';
import { TranslationsService } from '../services/translations.service';

const SECRET = 'translations-spec-jwt-secret-0123456789';
const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const ENTRY_ID = '22222222-2222-4222-8222-222222222222';
const MISSING_ID = '99999999-9999-4999-8999-999999999999';

function createInMemoryTranslationsRepo() {
  const store = new Map<string, Translation>();
  return {
    store,
    listAll: async () =>
      [...store.values()].sort((a, b) => a.namespace.localeCompare(b.namespace)),
    findById: async (id: string) => store.get(id) ?? null,
    findByNamespace: async (namespace: string) =>
      [...store.values()].find((item) => item.namespace === namespace) ?? null,
    create: (data: Partial<Translation>) =>
      Object.assign(new Translation(), {
        id: ENTRY_ID,
        updatedAt: new Date('2026-10-25T10:00:00.000Z'),
        ...data,
      }),
    save: async (entity: Translation) => {
      entity.updatedAt = new Date('2026-10-25T12:00:00.000Z');
      store.set(entity.id, entity);
      return entity;
    },
    remove: async (entity: Translation) => {
      store.delete(entity.id);
    },
  };
}

describe('TranslationsService — nghiệp vụ & làm sạch dữ liệu (#113)', () => {
  it('create() chuẩn hóa context, lọc bỏ locale lạ và lưu chuỗi hợp lệ', async () => {
    const repo = createInMemoryTranslationsRepo();
    const service = new TranslationsService(
      repo as unknown as TranslationsRepository,
    );

    const created = await service.create({
      namespace: 'exhibit.trong-dong.title',
      category: 'exhibit',
      context: '  Tiêu đề hiện vật  ',
      values: {
        vi: '  Trống đồng Ngọc Lũ  ',
        en: 'Ngoc Lu Bronze Drum',
        de: 'Nicht unterstützt',
      },
    });

    assert.equal(created.id, ENTRY_ID);
    assert.equal(created.namespace, 'exhibit.trong-dong.title');
    assert.equal(created.category, 'exhibit');
    assert.equal(created.context, 'Tiêu đề hiện vật');
    assert.deepEqual(created.values, {
      vi: 'Trống đồng Ngọc Lũ',
      en: 'Ngoc Lu Bronze Drum',
    });
  });

  it('create() ném 409 ConflictException khi namespace đã tồn tại', async () => {
    const repo = createInMemoryTranslationsRepo();
    const service = new TranslationsService(
      repo as unknown as TranslationsRepository,
    );

    await service.create({
      namespace: 'ui.cta.explore',
      category: 'ui',
      values: { vi: 'Khám phá' },
    });

    await assert.rejects(
      () =>
        service.create({
          namespace: 'ui.cta.explore',
          category: 'ui',
          values: { vi: 'Khám phá lại' },
        }),
      (err: unknown) =>
        err instanceof ConflictException &&
        /Namespace đã tồn tại/.test(err.message),
    );
  });

  it('updateValues() gộp bản dịch theo ngôn ngữ và báo 404 khi không tìm thấy', async () => {
    const repo = createInMemoryTranslationsRepo();
    const service = new TranslationsService(
      repo as unknown as TranslationsRepository,
    );

    await service.create({
      namespace: 'ui.banner.subtitle',
      category: 'ui',
      values: { vi: 'Bản gốc', en: 'Original' },
    });

    const updated = await service.updateValues(ENTRY_ID, {
      values: { en: '  Updated English  ', ja: '日本語' },
    });

    assert.deepEqual(updated.values, {
      vi: 'Bản gốc',
      en: 'Updated English',
      ja: '日本語',
    });

    await assert.rejects(
      () => service.updateValues(MISSING_ID, { values: { vi: 'Test' } }),
      (err: unknown) => err instanceof NotFoundException,
    );
  });

  it('remove() xóa bản ghi tồn tại và ném 404 khi ID không tồn tại', async () => {
    const repo = createInMemoryTranslationsRepo();
    const service = new TranslationsService(
      repo as unknown as TranslationsRepository,
    );

    await service.create({
      namespace: 'audio.intro.welcome',
      category: 'audio',
      values: { vi: 'Chào mừng' },
    });

    await service.remove(ENTRY_ID);
    assert.equal((await service.list()).length, 0);

    await assert.rejects(
      () => service.remove(ENTRY_ID),
      (err: unknown) => err instanceof NotFoundException,
    );
  });
});

describe('TranslationsController — HTTP RBAC & DTO Validation (#111, #113)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const repo = createInMemoryTranslationsRepo();
  const previousSecret = process.env.JWT_ACCESS_SECRET;

  function signToken(permissions: readonly string[]) {
    return jwt.signAsync(
      {
        sub: ACTOR_ID,
        email: 'editor@aura.local',
        displayName: 'Editor',
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
      controllers: [TranslationsController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
        TranslationsService,
        { provide: TranslationsRepository, useValue: repo },
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

  it('chặn 401 khi không có JWT và chặn 403 khi chỉ có quyền exhibit:* (không cho phép fallback)', async () => {
    const server = app.getHttpServer();
    await request(server).get('/translations').expect(401);

    const exhibitOnlyToken = await signToken([
      PERMISSIONS.EXHIBIT_READ,
      PERMISSIONS.EXHIBIT_UPDATE,
    ]);
    await request(server)
      .get('/translations')
      .set('Authorization', `Bearer ${exhibitOnlyToken}`)
      .expect(403);

    await request(server)
      .post('/translations')
      .set('Authorization', `Bearer ${exhibitOnlyToken}`)
      .send({
        namespace: 'exhibit.test.name',
        category: 'exhibit',
        values: { vi: 'Hiện vật' },
      })
      .expect(403);
  });

  it('cho phép GET với translation:read nhưng chặn POST/PATCH/DELETE nếu thiếu translation:manage', async () => {
    const server = app.getHttpServer();
    const readOnlyToken = await signToken([PERMISSIONS.TRANSLATION_READ]);

    await request(server)
      .get('/translations')
      .set('Authorization', `Bearer ${readOnlyToken}`)
      .expect(200);

    await request(server)
      .post('/translations')
      .set('Authorization', `Bearer ${readOnlyToken}`)
      .send({
        namespace: 'exhibit.test.name',
        category: 'exhibit',
        values: { vi: 'Hiện vật' },
      })
      .expect(403);

    await request(server)
      .patch(`/translations/${ENTRY_ID}`)
      .set('Authorization', `Bearer ${readOnlyToken}`)
      .send({ values: { en: 'Artifact' } })
      .expect(403);

    await request(server)
      .delete(`/translations/${ENTRY_ID}`)
      .set('Authorization', `Bearer ${readOnlyToken}`)
      .expect(403);
  });

  it('kiểm tra DTO validation (namespace sai định dạng, category không hợp lệ) và luồng CRUD với translation:manage', async () => {
    const server = app.getHttpServer();
    const manageToken = await signToken([
      PERMISSIONS.TRANSLATION_READ,
      PERMISSIONS.TRANSLATION_MANAGE,
    ]);

    // Namespace không hợp lệ (viết hoa / thiếu dấu chấm) -> 400
    await request(server)
      .post('/translations')
      .set('Authorization', `Bearer ${manageToken}`)
      .send({
        namespace: 'InvalidNamespace',
        category: 'ui',
        values: { vi: 'Lỗi' },
      })
      .expect(400);

    // Category không thuộc danh mục -> 400
    await request(server)
      .post('/translations')
      .set('Authorization', `Bearer ${manageToken}`)
      .send({
        namespace: 'ui.valid.key',
        category: 'unknown-category',
        values: { vi: 'Lỗi' },
      })
      .expect(400);

    // Tạo mới hợp lệ -> 201
    const created = await request(server)
      .post('/translations')
      .set('Authorization', `Bearer ${manageToken}`)
      .send({
        namespace: 'ui.header.title',
        category: 'ui',
        context: 'Tiêu đề thanh điều hướng',
        values: { vi: 'Bảo tàng Aura', en: 'Aura Museum' },
      })
      .expect(201);
    assert.equal(created.body.data.namespace, 'ui.header.title');

    // Tạo trùng namespace -> 409
    await request(server)
      .post('/translations')
      .set('Authorization', `Bearer ${manageToken}`)
      .send({
        namespace: 'ui.header.title',
        category: 'ui',
        values: { vi: 'Trùng' },
      })
      .expect(409);

    // Cập nhật bản dịch -> 200
    const patched = await request(server)
      .patch(`/translations/${ENTRY_ID}`)
      .set('Authorization', `Bearer ${manageToken}`)
      .send({ values: { fr: 'Musée Aura' } })
      .expect(200);
    assert.equal(patched.body.data.values.fr, 'Musée Aura');

    // Xóa chuỗi dịch -> 204
    await request(server)
      .delete(`/translations/${ENTRY_ID}`)
      .set('Authorization', `Bearer ${manageToken}`)
      .expect(204);
  });
});
