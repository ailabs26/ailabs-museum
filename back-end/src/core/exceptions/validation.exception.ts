import { UnprocessableEntityException } from '@nestjs/common';
import { ApiError } from '../http/api-response';

/** Lỗi validation nghiệp vụ (ngoài class-validator) -> 422 kèm danh sách field. */
export class DomainValidationException extends UnprocessableEntityException {
  constructor(errors: ApiError[], message = 'Dữ liệu không hợp lệ') {
    super({ message, errors });
  }
}
