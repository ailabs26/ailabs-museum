import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import { ReportsController } from '../controllers/reports.controller';
import { ContentReportsService } from '../services/content-reports.service';

const REPORT_ID = 'c1111111-1111-4111-1111-111111111111';

class TestUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    request.user = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'reviewer@example.test',
      displayName: 'Reviewer',
      roles: [],
      permissions: request.headers['x-test-permission'] === PERMISSIONS.REPORT_RESOLVE
        ? [PERMISSIONS.REPORT_RESOLVE]
        : [PERMISSIONS.REPORT_READ],
    };
    return true;
  }
}

describe('Admin report authorization HTTP', () => {
  let app: INestApplication;
  let status = 'open';
  let resolveCalls = 0;

  after(async () => {
    await app?.close();
  });

  it('requires report:resolve before changing report state', async () => {
    status = 'open';
    resolveCalls = 0;
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        PermissionsGuard,
        {
          provide: ContentReportsService,
          useValue: {
            resolve: async (_id: string, dto: { resolution: string }) => {
              resolveCalls++;
              status = 'resolved';
              return { id: REPORT_ID, status, resolution: dto.resolution };
            },
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalGuards(new TestUserGuard(), app.get(PermissionsGuard));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    const denied = await request(app.getHttpServer())
      .post(`/reports/${REPORT_ID}/resolve`)
      .set('x-test-permission', PERMISSIONS.REPORT_READ)
      .send({ resolution: 'Đã xác minh' })
      .expect(403);
    assert.equal(denied.body.success, false);
    assert.equal(status, 'open');
    assert.equal(resolveCalls, 0);

    const allowed = await request(app.getHttpServer())
      .post(`/reports/${REPORT_ID}/resolve`)
      .set('x-test-permission', PERMISSIONS.REPORT_RESOLVE)
      .send({ resolution: 'Đã xác minh' })
      .expect(201);
    assert.equal(allowed.body.success, true);
    assert.equal(allowed.body.data.status, 'resolved');
    assert.equal(status, 'resolved');
    assert.equal(resolveCalls, 1);
  });
});
