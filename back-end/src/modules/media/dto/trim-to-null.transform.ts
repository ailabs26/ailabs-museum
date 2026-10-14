import { Transform } from 'class-transformer';

/**
 * Cắt khoảng trắng hai đầu; chuỗi rỗng thành `null` (xóa giá trị). Giá trị không phải
 * chuỗi giữ nguyên để class-validator báo lỗi kiểu.
 */
export const TrimToNull = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  });
