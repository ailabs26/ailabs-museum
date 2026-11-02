import { afterEach, describe, expect, it } from 'vitest';
import { http } from '@/core/api/http-client';
import { actorLabel, auditService, filenameFromDisposition } from './audit.service';

describe('actorLabel', () => {
  it('có actor → email; sự kiện xác thực/truy cập không actor → Chưa đăng nhập; còn lại → hệ thống', () => {
    expect(actorLabel({ action: 'user.create', actor: { id: 'u', email: 'a@b.c', displayName: 'A' } })).toBe('a@b.c');
    expect(actorLabel({ action: 'auth.login_failed', actor: null })).toBe('Chưa đăng nhập');
    expect(actorLabel({ action: 'access.denied', actor: null })).toBe('Chưa đăng nhập');
    expect(actorLabel({ action: 'report.resolve', actor: null })).toBe('hệ thống');
  });
});

describe('xuất CSV', () => {
  const originalAdapter = http.raw.defaults.adapter;
  afterEach(() => {
    http.raw.defaults.adapter = originalAdapter;
  });

  it('filenameFromDisposition: lấy tên trong nháy; thiếu/sai → tên mặc định', () => {
    expect(filenameFromDisposition('attachment; filename="audit-logs-20261102-0304.csv"', 'x.csv')).toBe('audit-logs-20261102-0304.csv');
    expect(filenameFromDisposition(undefined, 'x.csv')).toBe('x.csv');
    expect(filenameFromDisposition('attachment', 'x.csv')).toBe('x.csv');
  });

  it('exportCsv gọi /audit/export dạng blob kèm bộ lọc (không phân trang), trả blob + tên file', async () => {
    let seen: { url?: string; params?: unknown; responseType?: string } = {};
    http.raw.defaults.adapter = async (config) => {
      seen = { url: config.url, params: config.params, responseType: config.responseType };
      return { status: 200, statusText: '', config, data: new Blob(['a']),
        headers: { 'content-disposition': 'attachment; filename="audit-logs-1.csv"' } };
    };
    const result = await auditService.exportCsv({ action: 'user.create', from: '2026-11-01T00:00:00.000Z' });
    expect(seen).toEqual({ url: '/audit/export', params: { action: 'user.create', from: '2026-11-01T00:00:00.000Z' }, responseType: 'blob' });
    expect(result.filename).toBe('audit-logs-1.csv');
    expect(result.blob).toBeInstanceOf(Blob);
  });
});
