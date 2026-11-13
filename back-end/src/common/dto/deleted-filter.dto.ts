import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Query `deleted=true` → chỉ lấy bản ghi đã xóa mềm (thùng rác); vắng hoặc `false` → bản ghi đang dùng.
 * Nhận chuỗi 'true'/'false' từ URL; giá trị khác bị từ chối (400), không ép kiểu ngầm thành true.
 */
export function DeletedFilter(): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({ type: Boolean, description: 'true: chỉ bản ghi đã xóa mềm (thùng rác)' }),
    IsOptional(),
    Transform(({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value)),
    IsBoolean({ message: 'deleted phải là true hoặc false' }),
  );
}

/** Query chỉ có bộ lọc thùng rác (cho danh sách không phân trang, vd vai trò). */
export class DeletedQueryDto {
  @DeletedFilter()
  deleted?: boolean;
}

/** Bản ghi trong thùng rác: response thường kèm thời điểm xóa. */
export type Trashed<T> = T & { deletedAt: Date | null };

/** Gắn `deletedAt` vào response khi đang xem thùng rác; danh sách thường giữ nguyên hình dạng cũ. */
export function withDeletedAt<T extends object>(
  response: T,
  entity: { deletedAt: Date | null },
  deleted: boolean | undefined,
): T | Trashed<T> {
  return deleted ? { ...response, deletedAt: entity.deletedAt } : response;
}
