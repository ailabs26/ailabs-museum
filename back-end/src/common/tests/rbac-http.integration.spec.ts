import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { appConfig, jwtConfig } from '../../config';
import type { RecordAccessDeniedInput } from '../../modules/audit/dto/record-access-denied.dto';
import { AuditService } from '../../modules/audit/services/audit.service';
import { PermissionDeniedFilter } from '../../modules/audit/filters/permission-denied.filter';
import { AuthController } from '../../modules/auth/controllers/auth.controller';
import { AuthService } from '../../modules/auth/services/auth.service';
import { TokenService } from '../../modules/auth/services/token.service';
import { AuthRateLimiter } from '../../modules/auth/services/auth-rate-limiter.service';
import { HealthController } from '../../modules/health/health.controller';
import { PermissionsController } from '../../modules/roles/controllers/permissions.controller';
import { RolesController } from '../../modules/roles/controllers/roles.controller';
import { RolesService } from '../../modules/roles/services/roles.service';
import { UsersController } from '../../modules/users/controllers/users.controller';
import { UsersService } from '../../modules/users/services/users.service';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, PermissionKey } from '../constants/permissions.constant';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { RoleKey } from '../enums/role.enum';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { ResponseInterceptor } from '../interceptors/response.interceptor';

/**
 * Integration test lớp RBAC: dựng Nest app với guard toàn cục THẬT (APP_GUARD như AppModule),
 * JwtService thật, controller thật; chỉ service nghiệp vụ là test double. Kiểm chứng chặn truy cập
 * trái phép trên toàn bộ route quản trị Users/Roles/Permissions.
 */
const SECRET = 'rbac-integration-secret-0123456789';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const ROLE_ID = '33333333-3333-4333-8333-333333333333';
const ADMIN_PERMISSIONS = new Set<PermissionKey>(DEFAULT_ROLE_PERMISSIONS[RoleKey.ADMIN]);

type Verb = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface RouteSpec {
  verb: Verb;
  path: string;
  required: PermissionKey[];
}

const VERBS: Partial<Record<RequestMethod, Verb>> = {
  [RequestMethod.GET]: 'get',
  [RequestMethod.POST]: 'post',
  [RequestMethod.PUT]: 'put',
  [RequestMethod.PATCH]: 'patch',
  [RequestMethod.DELETE]: 'delete',
};

/** Đọc metadata route + @Permissions của controller để kiểm thử MỌI route, không liệt kê tay. */
function collectRoutes(controller: new (...args: never[]) => object): RouteSpec[] {
  const base = Reflect.getMetadata(PATH_METADATA, controller) as string;
  const proto = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor' && typeof proto[name] === 'function')
    .filter((name) => Reflect.hasMetadata(PATH_METADATA, proto[name] as object))
    .map((name) => {
      const handler = proto[name] as object;
      const path = (Reflect.getMetadata(PATH_METADATA, handler) as string)
        .replace(':roleId', ROLE_ID)
        .replace(':id', USER_ID);
      return {
        verb: VERBS[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod]!,
        path: `/${base}${path === '/' ? '' : `/${path}`}`,
        required: (Reflect.getMetadata(PERMISSIONS_KEY, handler) as PermissionKey[] | undefined) ?? [],
      };
    });
}

const ADMIN_ROUTES = [UsersController, RolesController, PermissionsController].flatMap(collectRoutes);

/** Body hợp lệ tối thiểu theo DTO để request đi qua ValidationPipe tới service. */
function validBody(route: RouteSpec): object | undefined {
  const key = `${route.verb} ${route.path}`;
  if (key === 'post /users') return { email: 'new@aura.local', password: 'Str0ng-Passw0rd!', displayName: 'Mới' };
  if (key === 'post /roles') return { code: 'curator', name: 'Curator' };
  if (key === 'put /roles/permission-matrix') return { updates: [{ roleId: ROLE_ID, permissions: [] }] };
  if (route.path.endsWith('/permissions') && route.verb === 'put') return { permissions: [] };
  if (route.path.endsWith('/roles') && route.verb !== 'get') return { roleIds: [ROLE_ID] };
  if (route.verb === 'patch' && route.path.startsWith('/roles')) return { name: 'Đổi tên' };
  if (route.verb === 'patch') return { displayName: 'Đổi tên' };
  return undefined;
}

describe('RBAC HTTP — guard toàn cục trên route quản trị', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const serviceCalls: string[] = [];
  const denied: RecordAccessDeniedInput[] = [];

  /**
   * Proxy: mọi method nghiệp vụ trả { id } và ghi lại tên method được gọi. Bỏ qua `then` và
   * lifecycle hook (onModuleInit...) để Nest không coi đây là thenable/provider có hook.
   */
  function recordingService<T>(name: string): T {
    return new Proxy({}, {
      get: (_target, prop) => {
        if (typeof prop !== 'string' || prop === 'then' || /^on[A-Z]|^before[A-Z]/.test(prop)) return undefined;
        return () => {
          serviceCalls.push(`${name}.${prop}`);
          return Promise.resolve(prop === 'remove' ? null : { id: USER_ID });
        };
      },
    }) as T;
  }

  function tokenFor(permissions: readonly string[], options: { secret?: string; expiresIn?: number | string } = {}): Promise<string> {
    return jwt.signAsync(
      { sub: USER_ID, email: 'actor@aura.local', displayName: 'Actor', roles: [], permissions },
      { secret: options.secret ?? SECRET, expiresIn: options.expiresIn ?? '5m' },
    );
  }

  function send(route: RouteSpec, token?: string) {
    let req = request(app.getHttpServer())[route.verb](route.path);
    if (token) req = req.set('Authorization', `Bearer ${token}`);
    const body = validBody(route);
    return body ? req.send(body) : req;
  }

  const previousSecret = process.env.JWT_ACCESS_SECRET;

  before(async () => {
    process.env.JWT_ACCESS_SECRET = SECRET;
    const { Test } = await import('@nestjs/testing');
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [appConfig, jwtConfig] }),
        JwtModule.register({}),
      ],
      controllers: [UsersController, RolesController, PermissionsController, AuthController, HealthController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
        { provide: UsersService, useValue: recordingService('users') },
        { provide: RolesService, useValue: recordingService('roles') },
        { provide: AuthService, useValue: { me: (id: string) => Promise.resolve({ id }) } },
        { provide: TokenService, useValue: { refreshCookieMaxAgeMs: () => 1000 } },
        AuthRateLimiter,
        {
          provide: AuditService,
          useValue: { recordAccessDenied: async (input: RecordAccessDeniedInput) => void denied.push(input) },
        },
        PermissionDeniedFilter,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter(), app.get(PermissionDeniedFilter));
    await app.init();
    jwt = app.get(JwtService);
  });

  after(async () => {
    await app?.close();
    if (previousSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = previousSecret;
  });

  it('phát hiện đủ route quản trị và route nào cũng khai báo @Permissions', () => {
    assert.ok(ADMIN_ROUTES.length >= 16, `chỉ tìm thấy ${ADMIN_ROUTES.length} route`);
    for (const route of ADMIN_ROUTES) {
      assert.ok(route.required.length > 0, `${route.verb.toUpperCase()} ${route.path} thiếu @Permissions`);
      for (const permission of route.required) assert.ok(ALL_PERMISSIONS.includes(permission));
    }
  });

  it('route @Public() (health) truy cập được không cần token', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    assert.deepEqual(res.body, { success: true, data: { status: 'ok' }, message: null });
  });

  for (const route of ADMIN_ROUTES) {
    const label = `${route.verb.toUpperCase()} ${route.path}`;

    it(`${label}: 401 khi không có token, service không bị gọi`, async () => {
      serviceCalls.length = 0;
      const res = await send(route).expect(401);
      assert.equal(res.body.success, false);
      assert.deepEqual(serviceCalls, []);
    });

    it(`${label}: 403 khi thiếu quyền [${route.required.join(', ')}], ghi audit từ chối`, async () => {
      serviceCalls.length = 0;
      denied.length = 0;
      const others = [...ADMIN_PERMISSIONS].filter((permission) => !route.required.includes(permission));
      const res = await send(route, await tokenFor(others)).expect(403);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /^Thiếu quyền: /);
      assert.deepEqual(serviceCalls, []);
      assert.equal(denied.length, 1);
      assert.deepEqual([...denied[0].missingPermissions].sort(), [...route.required].sort());
      assert.equal(denied[0].actorId, USER_ID);
      assert.equal(denied[0].method, route.verb.toUpperCase());
    });

    it(`${label}: qua guard khi có đúng quyền yêu cầu`, async () => {
      serviceCalls.length = 0;
      const res = await send(route, await tokenFor(route.required));
      assert.ok([200, 201].includes(res.status), `${label} -> ${res.status} ${JSON.stringify(res.body)}`);
      assert.equal(serviceCalls.length, 1);
    });
  }

  it('401 khi token hết hạn hoặc ký bằng secret khác (kể cả mang đủ quyền)', async () => {
    const route = ADMIN_ROUTES.find((item) => item.path === '/users' && item.verb === 'get')!;
    await send(route, await tokenFor(ALL_PERMISSIONS, { expiresIn: -1 })).expect(401);
    await send(route, await tokenFor(ALL_PERMISSIONS, { secret: 'attacker-secret-attacker-secret' })).expect(401);
  });

  it('token không có quyền nào vẫn đọc được /auth/me (route chỉ cần xác thực)', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${await tokenFor([])}`)
      .expect(200);
    assert.equal(res.body.data.id, USER_ID);
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('role mặc định: editor bị chặn quản trị user, moderator chỉ đọc được danh mục quyền', async () => {
    const editor = await tokenFor(DEFAULT_ROLE_PERMISSIONS[RoleKey.EDITOR]);
    const moderator = await tokenFor(DEFAULT_ROLE_PERMISSIONS[RoleKey.MODERATOR]);
    const server = app.getHttpServer();
    await request(server).get('/users').set('Authorization', `Bearer ${editor}`).expect(403);
    await request(server).get('/roles').set('Authorization', `Bearer ${moderator}`).expect(403);
    await request(server).get('/permissions').set('Authorization', `Bearer ${moderator}`).expect(200);
    await request(server).get('/permissions').set('Authorization', `Bearer ${editor}`).expect(403);
  });
});
