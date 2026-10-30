import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/**
 * Query cho tìm kiếm hiện vật CÔNG KHAI (VT-077).
 * Kế thừa `PaginationQueryDto` để tái dùng hợp đồng phân trang chung (`page`, `pageSize`, `q`),
 * nên client cũ đã quen envelope `{ data, meta }` không phải học contract mới (backward-compatible).
 *
 * Khác với `ListExhibitsQueryDto` của Admin: KHÔNG có `status`/`visibility`/`deleted`.
 * Public chỉ thấy hiện vật đã xuất bản + đang hiển thị — ranh giới an ninh không để client chọn.
 *
 * LƯU Ý: `sort` kế thừa từ `PaginationQueryDto` được chấp nhận (whitelist) nhưng BỊ BỎ QUA —
 * thứ tự công khai luôn cố định `roomId, displayOrder, id` để bảo toàn invariant phân trang ổn định
 * (AC-4); client không được tự đổi thứ tự.
 */
export class PublicSearchQueryDto extends PaginationQueryDto {
  /** Lọc theo phòng trưng bày (tùy chọn). Sai định dạng → 400, không phải 500. */
  @IsOptional()
  @IsUUID(undefined, { message: 'roomId phải là định dạng UUID hợp lệ' })
  roomId?: string;
}
