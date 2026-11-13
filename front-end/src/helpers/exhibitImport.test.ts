import { afterEach, describe, expect, it } from 'vitest';
import { http } from '@/core/api/http-client';
import { ApiException } from '@/core/api/api-error';
import { exhibitsService, type ImportExhibitsResult } from '@/services/exhibits.service';
import { errorRows, importFileProblem, importSummary } from './exhibitImport';

const result = (overrides: Partial<ImportExhibitsResult> = {}): ImportExhibitsResult => ({
  dryRun: true,
  total: 3,
  valid: 2,
  created: 0,
  failed: 1,
  ids: [],
  rows: [
    { row: 1, status: 'valid', name: 'A', exhibitId: null, errors: [] },
    { row: 2, status: 'error', name: null, exhibitId: null, errors: [{ field: 'roomSlug', message: 'Không tìm thấy phòng' }, { field: 'row', message: 'Dòng thừa ô' }] },
    { row: 3, status: 'valid', name: 'C', exhibitId: null, errors: [] },
  ],
  ...overrides,
});

describe('importFileProblem (kiểm tra sớm ở trình duyệt)', () => {
  it('chấp nhận .csv/.json (không phân biệt hoa thường) trong giới hạn', () => {
    expect(importFileProblem({ name: 'hien-vat.CSV', size: 10 })).toBeNull();
    expect(importFileProblem({ name: 'x.json', size: 2_000_000 })).toBeNull();
    expect(importFileProblem(null)).toBeNull();
  });
  it('từ chối đuôi khác, file rỗng, file > 2 MB', () => {
    expect(importFileProblem({ name: 'x.xlsx', size: 10 })).toMatch(/\.csv hoặc \.json/);
    expect(importFileProblem({ name: 'x.csv', size: 0 })).toBe('File rỗng');
    expect(importFileProblem({ name: 'x.csv', size: 2_000_001 })).toMatch(/2 MB/);
  });
});

describe('errorRows / importSummary', () => {
  it('chỉ lấy dòng lỗi, gộp lỗi theo trường; lỗi cấp dòng không kèm tên trường', () => {
    expect(errorRows(result())).toEqual([
      expect.objectContaining({ row: 2, message: 'roomSlug: Không tìm thấy phòng · Dòng thừa ô' }),
    ]);
  });
  it('tóm tắt dry run và nhập thật, có/không có lỗi', () => {
    expect(importSummary(result())).toBe('2/3 dòng hợp lệ, 1 dòng lỗi (sẽ bị bỏ qua khi nhập).');
    expect(importSummary(result({ failed: 0, valid: 3 }))).toBe('Cả 3 dòng đều hợp lệ.');
    expect(importSummary(result({ dryRun: false, created: 2 }))).toBe('Đã tạo 2 bản nháp; 1 dòng lỗi chưa được nhập.');
    expect(importSummary(result({ dryRun: false, created: 3, failed: 0 }))).toBe('Đã tạo 3 bản nháp hiện vật.');
  });
});

describe('exhibitsService xuất/nhập', () => {
  const originalAdapter = http.raw.defaults.adapter;
  afterEach(() => {
    http.raw.defaults.adapter = originalAdapter;
  });

  it('exportFile gọi /admin/exhibits/export dạng blob với bộ lọc, lấy tên file từ header', async () => {
    let seen: { url?: string; params?: unknown; responseType?: string } = {};
    http.raw.defaults.adapter = async (config) => {
      seen = { url: config.url, params: config.params, responseType: config.responseType };
      return { status: 200, statusText: '', config, data: new Blob(['x']), headers: { 'content-disposition': 'attachment; filename="exhibits-20261113-1200.csv"' } };
    };
    const file = await exhibitsService.exportFile({ format: 'csv', roomId: 'r1', status: 'draft' });
    expect(seen).toEqual({ url: '/admin/exhibits/export', params: { format: 'csv', roomId: 'r1', status: 'draft' }, responseType: 'blob' });
    expect(file.filename).toBe('exhibits-20261113-1200.csv');
  });

  it('exportFile thiếu header → tên mặc định theo định dạng', async () => {
    http.raw.defaults.adapter = async (config) => ({ status: 200, statusText: '', config, data: new Blob(['{}']), headers: {} });
    expect((await exhibitsService.exportFile({ format: 'json' })).filename).toBe('exhibits.json');
  });

  it('importFile gửi multipart field "file" và dryRun, trả data đã bóc envelope', async () => {
    let seen: { url?: string; params?: unknown; isForm?: boolean; hasFile?: boolean } = {};
    http.raw.defaults.adapter = async (config) => {
      const body = config.data as FormData;
      seen = { url: config.url, params: config.params, isForm: body instanceof FormData, hasFile: body.get('file') instanceof Blob };
      return { status: 200, statusText: '', config, headers: {}, data: { success: true, data: result(), message: null } };
    };
    const data = await exhibitsService.importFile(new File(['roomSlug\nx'], 'a.csv', { type: 'text/csv' }), true);
    expect(seen).toEqual({ url: '/admin/exhibits/import', params: { dryRun: true }, isForm: true, hasFile: true });
    expect(data.total).toBe(3);
  });

  it('importFile lỗi cấp file → ApiException mang thông điệp tiếng Việt của back-end', async () => {
    http.raw.defaults.adapter = async (config) => {
      const error = Object.assign(new Error('Request failed'), {
        isAxiosError: true,
        config,
        response: { status: 422, statusText: '', config, headers: {}, data: { success: false, data: null, message: 'Cột không được hỗ trợ: ten', errors: [{ field: 'file', code: 'exhibit_import_invalid_file', message: 'Cột không được hỗ trợ: ten' }] } },
      });
      throw error;
    };
    const failure = await exhibitsService.importFile(new File(['ten\nA'], 'a.csv'), false).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiException);
    expect((failure as ApiException).status).toBe(422);
    expect((failure as ApiException).message).toBe('Cột không được hỗ trợ: ten');
  });
});
