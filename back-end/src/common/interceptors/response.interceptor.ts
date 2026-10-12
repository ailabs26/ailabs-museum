import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse, ok } from '../dto/api-response';
import { isPaginated } from '../types/paginated.type';

/**
 * Bọc mọi giá trị controller trả về thành ApiResponse.
 * - Paginated<T> -> { data: items, meta: { page, pageSize, total } }
 * - Giá trị thường -> { data }
 * - Nếu đã là ApiResponse (có 'success') thì giữ nguyên.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<unknown>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<unknown>> {
    return next.handle().pipe(
      map((value) => {
        if (value && typeof value === 'object' && 'success' in value) {
          return value as unknown as ApiResponse<unknown>;
        }
        if (isPaginated(value)) {
          return ok(value.items, {
            page: value.page,
            pageSize: value.pageSize,
            total: value.total,
          });
        }
        return ok(value ?? null);
      }),
    );
  }
}
