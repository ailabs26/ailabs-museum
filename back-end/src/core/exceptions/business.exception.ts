import { ConflictException, HttpException, HttpStatus } from '@nestjs/common';

/** Lỗi nghiệp vụ chung (mặc định 409 Conflict). Vd: xung đột sửa đồng thời. */
export class BusinessException extends HttpException {
  constructor(message: string, status: HttpStatus = HttpStatus.CONFLICT) {
    super(message, status);
  }
}

/** Xung đột phiên bản khi sửa đồng thời (optimistic concurrency) -> 409. */
export class ConcurrencyConflictException extends ConflictException {
  constructor(entity = 'bản ghi') {
    super(`${entity} đã bị thay đổi bởi người khác. Vui lòng tải lại và thử lại.`);
  }
}
