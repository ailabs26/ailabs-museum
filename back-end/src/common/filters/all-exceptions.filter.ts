import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiError, ApiResponse } from '../dto/api-response';

/**
 * Bắt MỌI exception -> chuẩn hóa thành ApiResponse lỗi với HTTP status đúng.
 * (Tương ứng ExceptionHandlingMiddleware bên .NET tham khảo.)
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Lỗi hệ thống không mong muốn';
    let errors: ApiError[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        const body = res as Record<string, unknown>;
        message = this.pickMessage(body) ?? exception.message;
        errors = this.toErrors(body);
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception.message, exception.stack);
    }

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url} -> ${status}: ${message}`);
    }

    const payload: ApiResponse<null> = {
      success: false,
      data: null,
      message,
      ...(errors && errors.length ? { errors } : {}),
    };
    response.status(status).json(payload);
  }

  private pickMessage(body: Record<string, unknown>): string | null {
    const raw = body.message;
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw) && raw.length) return 'Dữ liệu không hợp lệ';
    return (body.error as string) ?? null;
  }

  /** Chuyển message[] của ValidationPipe thành danh sách ApiError. */
  private toErrors(body: Record<string, unknown>): ApiError[] | undefined {
    const raw = body.message;
    if (Array.isArray(raw)) {
      return raw.map((item) => ({ code: 'validation', message: String(item) }));
    }
    if (Array.isArray(body.errors)) {
      return body.errors as ApiError[];
    }
    return undefined;
  }
}
