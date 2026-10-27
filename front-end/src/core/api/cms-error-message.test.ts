import { describe, expect, it } from 'vitest';
import { cmsErrorMessage } from './cms-error-message';

describe('cmsErrorMessage', () => {
  it('409 ưu tiên message từ server (fallback)', () => {
    expect(cmsErrorMessage(409, 'Bản ghi đã đổi')).toBe('Bản ghi đã đổi');
  });

  it('409 không có fallback dùng mặc định tải lại', () => {
    expect(cmsErrorMessage(409)).toMatch(/tải lại/);
  });

  it('403 luôn là thông điệp thiếu quyền', () => {
    expect(cmsErrorMessage(403, 'bị bỏ qua')).toMatch(/không đủ quyền/);
  });

  it('422/400 là dữ liệu không hợp lệ khi không có fallback', () => {
    expect(cmsErrorMessage(422)).toMatch(/không hợp lệ/);
    expect(cmsErrorMessage(400)).toMatch(/không hợp lệ/);
  });

  it('0 là mất kết nối máy chủ', () => {
    expect(cmsErrorMessage(0)).toMatch(/Mất kết nối/);
  });

  it('mã khác dùng fallback nếu có', () => {
    expect(cmsErrorMessage(500, 'Lỗi máy chủ')).toBe('Lỗi máy chủ');
  });

  it('404, 413, 429 có thông điệp mặc định tiếng Việt rõ ràng', () => {
    expect(cmsErrorMessage(404)).toMatch(/Không tìm thấy/);
    expect(cmsErrorMessage(413)).toMatch(/vượt quá giới hạn/);
    expect(cmsErrorMessage(429)).toMatch(/quá nhanh/);
  });
});
