import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ArgumentsHost,
  BadRequestException,
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Logger,
  StreamableFile,
} from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { lastValueFrom, of } from 'rxjs';
import { CurrentUser } from '../decorators/current-user.decorator';
import { fail, ok } from '../dto/api-response';
import { IdParamDto } from '../dto/id-param.dto';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { BusinessException, ConcurrencyConflictException } from '../exceptions/business.exception';
import { EntityNotFoundException } from '../exceptions/not-found.exception';
import { DomainValidationException } from '../exceptions/validation.exception';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';
import { ResponseInterceptor } from '../interceptors/response.interceptor';
import { REQUEST_ID_HEADER, RequestIdMiddleware } from '../middleware/request-id.middleware';
import { PasswordService } from '../security/password.service';
import { isPaginated } from '../types/paginated.type';

interface CapturedResponse {
  status?: number;
  body?: unknown;
}

function httpHost(captured: CapturedResponse): ArgumentsHost {
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  };
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ method: 'GET', url: '/x' }),
    }),
  } as unknown as ArgumentsHost;
}

function filterResult(exception: unknown): CapturedResponse {
  const captured: CapturedResponse = {};
  new AllExceptionsFilter().catch(exception, httpHost(captured));
  return captured;
}

describe('AllExceptionsFilter', () => {
  // Lỗi 5xx được log có chủ đích; tắt log để output test gọn.
  Logger.overrideLogger(false);

  it('HttpException với message chuỗi', () => {
    assert.deepEqual(filterResult(new EntityNotFoundException('Room', 'r1')), {
      status: 404,
      body: { success: false, data: null, message: "Không tìm thấy Room với id 'r1'" },
    });
  });

  it('message[] của ValidationPipe → 400 + errors[] code validation', () => {
    const result = filterResult(new BadRequestException(['email must be an email', 'password too short']));
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, {
      success: false,
      data: null,
      message: 'Dữ liệu không hợp lệ',
      errors: [
        { code: 'validation', message: 'email must be an email' },
        { code: 'validation', message: 'password too short' },
      ],
    });
  });

  it('DomainValidationException giữ nguyên errors có field', () => {
    const errors = [{ field: 'name', code: 'required', message: 'Bắt buộc' }];
    const result = filterResult(new DomainValidationException(errors));
    assert.equal(result.status, 422);
    assert.deepEqual(result.body, { success: false, data: null, message: 'Dữ liệu không hợp lệ', errors });
  });

  it('HttpException với response là chuỗi thuần', () => {
    assert.deepEqual(filterResult(new BusinessException('Trùng lặp')), {
      status: 409,
      body: { success: false, data: null, message: 'Trùng lặp' },
    });
  });

  it('dùng body.error khi không có message', () => {
    const exception = new BadRequestException({ error: 'Bad thing' });
    assert.equal((filterResult(exception).body as { message: string }).message, 'Bad thing');
  });

  it('rơi về exception.message khi body không có message/error', () => {
    const exception = new BadRequestException({ foo: 'bar' });
    assert.equal((filterResult(exception).body as { message: string }).message, 'Bad Request Exception');
  });

  it('Error thường → 500 nhưng không làm lộ stack trace', () => {
    const result = filterResult(new Error('db exploded'));
    assert.equal(result.status, HttpStatus.INTERNAL_SERVER_ERROR);
    assert.deepEqual(result.body, { success: false, data: null, message: 'db exploded' });
  });

  it('giá trị ném không phải Error → 500 với thông điệp chung', () => {
    const result = filterResult('weird');
    assert.equal(result.status, 500);
    assert.equal((result.body as { message: string }).message, 'Lỗi hệ thống không mong muốn');
  });
});

describe('Exceptions', () => {
  it('BusinessException mặc định 409, cho phép đổi status', () => {
    assert.equal(new BusinessException('x').getStatus(), 409);
    assert.equal(new BusinessException('x', HttpStatus.GONE).getStatus(), 410);
  });

  it('ConcurrencyConflictException 409 kèm tên thực thể', () => {
    const error = new ConcurrencyConflictException('Hiện vật');
    assert.equal(error.getStatus(), 409);
    assert.match(error.message, /^Hiện vật đã bị thay đổi/);
    assert.match(new ConcurrencyConflictException().message, /^bản ghi/);
  });

  it('EntityNotFoundException không có id', () => {
    assert.equal(new EntityNotFoundException('Room').message, 'Không tìm thấy Room');
  });

  it('DomainValidationException cho phép message tùy chỉnh', () => {
    const response = new DomainValidationException([], 'Sai dữ liệu').getResponse() as { message: string };
    assert.equal(response.message, 'Sai dữ liệu');
  });
});

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor();
  const wrap = (value: unknown) =>
    lastValueFrom(interceptor.intercept({} as ExecutionContext, { handle: () => of(value) } as CallHandler));

  it('bọc giá trị thường thành ApiResponse', async () => {
    assert.deepEqual(await wrap({ a: 1 }), { success: true, data: { a: 1 }, message: null });
  });

  it('undefined → data null', async () => {
    assert.deepEqual(await wrap(undefined), { success: true, data: null, message: null });
  });

  it('Paginated → data = items + meta', async () => {
    assert.deepEqual(await wrap({ items: [1, 2], total: 7, page: 2, pageSize: 2 }), {
      success: true,
      data: [1, 2],
      message: null,
      meta: { page: 2, pageSize: 2, total: 7 },
    });
  });

  it('giữ nguyên giá trị đã là ApiResponse', async () => {
    const envelope = fail('x');
    assert.equal(await wrap(envelope), envelope);
  });

  it('không bọc StreamableFile', async () => {
    const file = new StreamableFile(Buffer.from('abc'));
    assert.equal(await wrap(file), file);
  });
});

describe('api-response / paginated helpers', () => {
  it('ok() kèm và không kèm meta', () => {
    assert.deepEqual(ok(1), { success: true, data: 1, message: null });
    assert.deepEqual(ok([], { page: 1, pageSize: 10, total: 0 }).meta, { page: 1, pageSize: 10, total: 0 });
  });

  it('fail() kèm và không kèm errors', () => {
    assert.deepEqual(fail('x'), { success: false, data: null, message: 'x' });
    assert.deepEqual(fail('x', [{ code: 'c', message: 'm' }]).errors, [{ code: 'c', message: 'm' }]);
  });

  it('isPaginated nhận diện đúng hình dạng', () => {
    assert.equal(isPaginated({ items: [], total: 0, page: 1, pageSize: 1 }), true);
    assert.equal(isPaginated({ items: 'x', total: 0, page: 1, pageSize: 1 }), false);
    assert.equal(isPaginated({ items: [] }), false);
    assert.equal(isPaginated(null), false);
    assert.equal(isPaginated('x'), false);
  });
});

describe('RequestIdMiddleware', () => {
  function runMiddleware(headers: Record<string, unknown>): { request: string; response?: string; nextCalled: boolean } {
    const req = { headers } as never;
    let response: string | undefined;
    let nextCalled = false;
    const res = { setHeader: (_name: string, value: string) => void (response = value) } as never;
    new RequestIdMiddleware().use(req, res, () => void (nextCalled = true));
    return { request: headers[REQUEST_ID_HEADER] as string, response, nextCalled };
  }

  it('giữ X-Request-Id client gửi lên và phản hồi lại', () => {
    assert.deepEqual(runMiddleware({ [REQUEST_ID_HEADER]: 'abc' }), { request: 'abc', response: 'abc', nextCalled: true });
  });

  it('cắt X-Request-Id quá dài về 100 ký tự', () => {
    const result = runMiddleware({ [REQUEST_ID_HEADER]: 'x'.repeat(500) });
    assert.equal(result.request.length, 100);
  });

  it('sinh uuid khi header rỗng/không hợp lệ', () => {
    for (const value of [undefined, '   ', ['a', 'b']]) {
      const result = runMiddleware({ [REQUEST_ID_HEADER]: value });
      assert.match(result.request, /^[0-9a-f-]{36}$/);
      assert.equal(result.response, result.request);
    }
  });
});

describe('DTO dùng chung', () => {
  it('PaginationQueryDto: mặc định, ép kiểu, skip', () => {
    const dto = plainToInstance(PaginationQueryDto, { page: '3', pageSize: '10' });
    assert.deepEqual(validateSync(dto), []);
    assert.equal(dto.skip, 20);
    const defaults = plainToInstance(PaginationQueryDto, {});
    assert.equal(defaults.page, 1);
    assert.equal(defaults.pageSize, 20);
  });

  it('PaginationQueryDto: chặn page < 1 và pageSize > 100', () => {
    const errors = validateSync(plainToInstance(PaginationQueryDto, { page: '0', pageSize: '101' }));
    assert.deepEqual(errors.map((error) => error.property).sort(), ['page', 'pageSize']);
  });

  it('IdParamDto chỉ nhận UUID', () => {
    assert.equal(validateSync(plainToInstance(IdParamDto, { id: 'not-a-uuid' })).length, 1);
    assert.equal(validateSync(plainToInstance(IdParamDto, { id: '6f1c2f0e-5b1a-4c55-9a0e-1c2b3d4e5f60' })).length, 0);
  });
});

describe('@CurrentUser()', () => {
  class Target {
    handler(): void {}
  }
  const user = { id: 'u1', email: 'e', displayName: 'd', roles: [], permissions: [] };

  function resolve(data?: string, requestUser: unknown = user): unknown {
    const decorator = data ? CurrentUser(data as never) : CurrentUser();
    decorator(Target.prototype, 'handler', 0);
    const meta = Reflect.getMetadata(ROUTE_ARGS_METADATA, Target, 'handler') as Record<string, {
      factory: (data: unknown, ctx: ExecutionContext) => unknown;
      data: unknown;
    }>;
    const entry = Object.values(meta).at(-1)!;
    const ctx = { switchToHttp: () => ({ getRequest: () => ({ user: requestUser }) }) } as ExecutionContext;
    return entry.factory(entry.data, ctx);
  }

  it('trả toàn bộ user hoặc một trường', () => {
    assert.deepEqual(resolve(), user);
    assert.equal(resolve('email'), 'e');
    assert.equal(resolve('email', null), undefined);
  });
});

describe('PasswordService', () => {
  const service = new PasswordService({ getOrThrow: () => 4 } as unknown as ConfigService);

  it('hash bằng bcrypt với cost từ config và so khớp đúng', async () => {
    const hash = await service.hash('S3cret!');
    assert.equal(bcrypt.getRounds(hash), 4);
    assert.notEqual(hash, 'S3cret!');
    assert.equal(await service.compare('S3cret!', hash), true);
    assert.equal(await service.compare('wrong', hash), false);
  });

  it('không có hash (user không tồn tại) vẫn chạy bcrypt với dummy hash và trả false', async () => {
    await service.onModuleInit();
    assert.equal(await service.compare('anything'), false);
    assert.equal(await service.compare('anything', undefined), false);
  });
});
