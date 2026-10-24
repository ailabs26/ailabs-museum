import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PERMISSIONS, PermissionKey } from '../constants/permissions.constant';
import { Permissions } from '../decorators/permissions.decorator';
import { Public } from '../decorators/public.decorator';
import { PermissionDeniedException } from '../exceptions/permission-denied.exception';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { AuthUser } from '../types/auth-user.type';

const SECRET = 'unit-test-access-secret-0123456789';
const jwt = new JwtService();
const config = { getOrThrow: () => SECRET } as unknown as ConfigService;
const reflector = new Reflector();

class SampleController {
  open(): void {}
  protectedRoute(): void {}
  readUsers(): void {}
  manageUsers(): void {}
}
Public()(SampleController.prototype, 'open', Object.getOwnPropertyDescriptor(SampleController.prototype, 'open')!);
Permissions(PERMISSIONS.USER_READ)(
  SampleController.prototype,
  'readUsers',
  Object.getOwnPropertyDescriptor(SampleController.prototype, 'readUsers')!,
);
Permissions(PERMISSIONS.USER_UPDATE, PERMISSIONS.ROLE_ASSIGN)(
  SampleController.prototype,
  'manageUsers',
  Object.getOwnPropertyDescriptor(SampleController.prototype, 'manageUsers')!,
);

/** Controller công khai ở cấp class: mọi handler đều bỏ qua xác thực. */
@Public()
class PublicController {
  anything(): void {}
}

type Handler = keyof SampleController | 'anything';

function context(
  handler: Handler,
  request: Record<string, unknown>,
  controller: new () => object = SampleController,
): ExecutionContext {
  const proto = controller.prototype as Record<string, () => void>;
  return {
    getHandler: () => proto[handler],
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function sign(payload: object, options: { secret?: string; expiresIn?: string | number } = {}): Promise<string> {
  return jwt.signAsync(payload, { secret: options.secret ?? SECRET, expiresIn: options.expiresIn ?? '5m' });
}

const USER_PAYLOAD = {
  sub: '11111111-1111-4111-8111-111111111111',
  email: 'editor@aura.local',
  displayName: 'Editor',
  roles: ['editor'],
  permissions: [PERMISSIONS.USER_READ],
};

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard(reflector, jwt, config);

  it('cho qua route @Public() ở cấp handler mà không cần token', async () => {
    assert.equal(await guard.canActivate(context('open', { headers: {} })), true);
  });

  it('cho qua mọi handler khi @Public() đặt ở cấp class', async () => {
    assert.equal(await guard.canActivate(context('anything', { headers: {} }, PublicController)), true);
  });

  it('401 khi thiếu header Authorization', async () => {
    await assert.rejects(guard.canActivate(context('protectedRoute', { headers: {} })), (error: unknown) => {
      assert.ok(error instanceof UnauthorizedException);
      assert.equal(error.message, 'Thiếu access token');
      return true;
    });
  });

  for (const header of ['Basic abc', 'Bearer', 'bearer token', 'Token abc']) {
    it(`401 khi scheme không đúng chuẩn Bearer: "${header}"`, async () => {
      await assert.rejects(
        guard.canActivate(context('protectedRoute', { headers: { authorization: header } })),
        UnauthorizedException,
      );
    });
  }

  it('401 khi token ký bằng secret khác', async () => {
    const token = await sign(USER_PAYLOAD, { secret: 'another-secret-another-secret' });
    await assert.rejects(
      guard.canActivate(context('protectedRoute', { headers: { authorization: `Bearer ${token}` } })),
      (error: unknown) => error instanceof UnauthorizedException
        && error.message === 'Access token không hợp lệ hoặc đã hết hạn',
    );
  });

  it('401 khi token đã hết hạn', async () => {
    const token = await sign(USER_PAYLOAD, { expiresIn: -10 });
    await assert.rejects(
      guard.canActivate(context('protectedRoute', { headers: { authorization: `Bearer ${token}` } })),
      UnauthorizedException,
    );
  });

  it('401 khi token bị sửa payload (chữ ký không khớp)', async () => {
    const token = await sign(USER_PAYLOAD);
    const [header, , signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...USER_PAYLOAD, permissions: ['user:delete'] })).toString('base64url');
    await assert.rejects(
      guard.canActivate(context('protectedRoute', { headers: { authorization: `Bearer ${header}.${forged}.${signature}` } })),
      UnauthorizedException,
    );
  });

  it('gắn AuthUser vào request.user khi token hợp lệ', async () => {
    const request: { headers: object; user?: AuthUser } = {
      headers: { authorization: `Bearer ${await sign(USER_PAYLOAD)}` },
    };
    assert.equal(await guard.canActivate(context('protectedRoute', request)), true);
    assert.deepEqual(request.user, {
      id: USER_PAYLOAD.sub,
      email: USER_PAYLOAD.email,
      displayName: USER_PAYLOAD.displayName,
      roles: USER_PAYLOAD.roles,
      permissions: USER_PAYLOAD.permissions,
    });
  });

  it('roles/permissions mặc định là [] khi payload thiếu', async () => {
    const request: { headers: object; user?: AuthUser } = {
      headers: { authorization: `Bearer ${await sign({ sub: 'u1', email: 'a@b.c', displayName: 'A' })}` },
    };
    await guard.canActivate(context('protectedRoute', request));
    assert.deepEqual(request.user?.roles, []);
    assert.deepEqual(request.user?.permissions, []);
  });
});

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(reflector);
  const userWith = (...permissions: PermissionKey[]): AuthUser => ({
    id: 'u1',
    email: 'u@aura.local',
    displayName: 'U',
    roles: [],
    permissions,
  });

  it('bỏ qua route @Public()', () => {
    assert.equal(guard.canActivate(context('open', {})), true);
  });

  it('bỏ qua route không khai báo @Permissions()', () => {
    assert.equal(guard.canActivate(context('protectedRoute', { user: userWith() })), true);
  });

  it('403 khi route yêu cầu quyền mà request chưa có user', () => {
    assert.throws(() => guard.canActivate(context('readUsers', {})), (error: unknown) =>
      error instanceof ForbiddenException && !(error instanceof PermissionDeniedException));
  });

  it('cho qua khi user có đủ quyền', () => {
    assert.equal(guard.canActivate(context('readUsers', { user: userWith(PERMISSIONS.USER_READ) })), true);
  });

  it('403 PermissionDeniedException liệt kê đúng quyền thiếu', () => {
    assert.throws(
      () => guard.canActivate(context('manageUsers', { user: userWith(PERMISSIONS.USER_UPDATE) })),
      (error: unknown) => {
        assert.ok(error instanceof PermissionDeniedException);
        assert.deepEqual(error.requiredPermissions, [PERMISSIONS.USER_UPDATE, PERMISSIONS.ROLE_ASSIGN]);
        assert.deepEqual(error.missingPermissions, [PERMISSIONS.ROLE_ASSIGN]);
        assert.equal(error.getStatus(), 403);
        assert.equal(error.message, 'Thiếu quyền: role:assign');
        return true;
      },
    );
  });

  it('yêu cầu TẤT CẢ quyền (AND), không phải một trong số (OR)', () => {
    assert.throws(
      () => guard.canActivate(context('manageUsers', { user: userWith(PERMISSIONS.ROLE_ASSIGN) })),
      PermissionDeniedException,
    );
    assert.equal(
      guard.canActivate(context('manageUsers', { user: userWith(PERMISSIONS.ROLE_ASSIGN, PERMISSIONS.USER_UPDATE) })),
      true,
    );
  });

  it('coi permissions undefined như rỗng', () => {
    const user = { ...userWith(), permissions: undefined } as unknown as AuthUser;
    assert.throws(() => guard.canActivate(context('readUsers', { user })), PermissionDeniedException);
  });

  it('so khớp chính xác chuỗi quyền, không theo tiền tố', () => {
    const user = { ...userWith(), permissions: ['user:*', 'user', 'USER:READ'] } as unknown as AuthUser;
    assert.throws(() => guard.canActivate(context('readUsers', { user })), PermissionDeniedException);
  });
});
