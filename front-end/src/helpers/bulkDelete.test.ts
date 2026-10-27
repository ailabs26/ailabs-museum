import { describe, expect, it } from 'vitest';
import { ApiException } from '@/core/api/api-error';
import { bulkDeleteFailures } from './bulkDelete';

describe('bulkDeleteFailures', () => {
  it('ánh xạ ID → tên kèm lý do; ID không có trong trang thì giữ nguyên ID', () => {
    const error = new ApiException('Không xóa được 2 mục', 409, [
      { code: 'delete_blocked', field: 'a', message: 'Đang được dùng' },
      { code: 'delete_blocked', field: 'b', message: 'Không tìm thấy' },
    ]);
    expect(bulkDeleteFailures(error, (id) => (id === 'a' ? 'Phòng A' : undefined))).toEqual([
      'Phòng A — Đang được dùng',
      'b — Không tìm thấy',
    ]);
  });

  it('không phải 409 xóa hàng loạt → null', () => {
    expect(bulkDeleteFailures(new ApiException('x', 500), () => 'n')).toBeNull();
    expect(bulkDeleteFailures(new ApiException('x', 409), () => 'n')).toBeNull();
    expect(bulkDeleteFailures(new Error('x'), () => 'n')).toBeNull();
  });
});
