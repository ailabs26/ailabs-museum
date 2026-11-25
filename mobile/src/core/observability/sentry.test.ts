import * as Sentry from '@sentry/react-native';
import { ApiException, CANCELED_ERROR_CODE } from '@/core/api/api-error';
import type { ApiErrorRecord } from './api-error-log';
import { createApiErrorSink, initSentry, reportError, scrubBreadcrumb, scrubEvent, scrubText } from './sentry';

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

type Event = Parameters<typeof scrubEvent>[0];
const record = (over: Partial<ApiErrorRecord> = {}): ApiErrorRecord => ({
  at: 0, method: 'GET', endpoint: '/rooms/:id', status: 503, code: null, message: 'a@b.c', durationMs: 5, requestId: 'req-1', ...over,
});

beforeEach(() => jest.clearAllMocks());

describe('lọc dữ liệu riêng tư', () => {
  it('che email, token, hex dài, query', () => {
    const jwt = 'eyJhbGciOi.eyJzdWIi.c2ln';
    const out = scrubText(`a.b+x@mail.com Bearer abc.def ${jwt} ${'f0'.repeat(32)} https://x.vn/p?sig=1#t`);
    expect(out).toBe('[email] [token] [token] [hex] https://x.vn/p');
  });

  it('bỏ user, request, extra, tên máy; che message và exception', () => {
    const event = {
      user: { id: 'u', email: 'a@b.c' }, request: { url: 'x' }, server_name: 'may', extra: { body: 1 },
      contexts: { device: { name: 'iPhone của Thắng', model: 'iPhone15' } },
      message: 'lỗi a@b.c', exception: { values: [{ type: 'Error', value: 'token Bearer zzz' }] },
    } as unknown as Event;
    expect(scrubEvent(event, {})).toEqual({
      contexts: { device: { model: 'iPhone15' } },
      message: 'lỗi [email]', exception: { values: [{ type: 'Error', value: 'token [token]' }] },
    });
  });

  it('mất mạng / request bị hủy không gửi; lỗi khác vẫn gửi', () => {
    const event = () => ({}) as Event;
    expect(scrubEvent(event(), { originalException: new ApiException('x', 0) })).toBeNull();
    expect(scrubEvent(event(), { originalException: new ApiException('x', 0, [{ code: CANCELED_ERROR_CODE, message: '' }]) })).toBeNull();
    expect(scrubEvent(event(), { originalException: new Error('bug') })).not.toBeNull();
  });

  it('breadcrumb: request chỉ còn method/đường dẫn gom nhóm/status; console và thao tác chạm bị bỏ', () => {
    expect(scrubBreadcrumb({ category: 'xhr', data: { method: 'GET', url: 'https://x.vn/rooms/42?email=a@b.c', status_code: 200, body: 'bí mật' } }))
      .toMatchObject({ data: { method: 'GET', url: '/rooms/:id', status_code: 200 } });
    expect(JSON.stringify(scrubBreadcrumb({ category: 'fetch', message: 'a@b.c', data: { url: '/x?t=a@b.c', body: 'a@b.c' } }))).not.toContain('a@b.c');
    expect(scrubBreadcrumb({ category: 'console', message: 'bí mật' })).toBeNull();
    expect(scrubBreadcrumb({ category: 'touch', message: 'bí mật' })).toBeNull();
  });
});

describe('sink lỗi API', () => {
  it('5xx gửi sự kiện gom theo endpoint, không kèm message của server', () => {
    createApiErrorSink()(record());
    expect(Sentry.captureMessage).toHaveBeenCalledWith('API 503 GET /rooms/:id', expect.objectContaining({ fingerprint: ['api', 'GET', '/rooms/:id', '503'] }));
    expect(JSON.stringify((Sentry.captureMessage as jest.Mock).mock.calls)).not.toContain('a@b.c');
  });

  it('cùng lỗi lặp lại trong 1 phút chỉ gửi một lần', () => {
    let t = 0;
    const sink = createApiErrorSink(() => t);
    sink(record());
    t = 59_999;
    sink(record());
    sink(record({ endpoint: '/auth/me' }));
    t = 60_000;
    sink(record());
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(3);
  });

  it('4xx và mất mạng chỉ là breadcrumb', () => {
    const sink = createApiErrorSink();
    sink(record({ status: 404 }));
    sink(record({ status: 0 }));
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
    expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(2);
  });
});

describe('khởi tạo', () => {
  it('không có DSN -> không khởi tạo; có DSN -> đúng một lần, tắt PII', () => {
    initSentry(null);
    expect(Sentry.init).not.toHaveBeenCalled();
    initSentry('https://k@o.ingest/1');
    initSentry('https://k@o.ingest/1');
    expect(Sentry.init).toHaveBeenCalledTimes(1);
    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ sendDefaultPii: false, beforeSend: scrubEvent, beforeBreadcrumb: scrubBreadcrumb }));
  });

  it('Sentry.init lỗi không làm hỏng app', () => {
    jest.isolateModules(() => {
      const isolated = require('@sentry/react-native') as typeof Sentry;
      (isolated.init as jest.Mock).mockImplementationOnce(() => {
        throw new Error('native thiếu');
      });
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      expect(() => (require('./sentry') as typeof import('./sentry')).initSentry('https://k@o.ingest/1')).not.toThrow();
      warn.mockRestore();
    });
  });

  it('reportError bỏ qua mất mạng', () => {
    reportError(new ApiException('x', 0));
    reportError(new Error('bug'));
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});
