import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
  Type,
  mixin,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { Observable } from 'rxjs';

export interface UploadFileOptions {
  /** Tên field multipart chứa file. */
  field: string;
  limits: NonNullable<MulterOptions['limits']>;
  /** Thông điệp khi vượt `limits.fileSize`, vd "File nhập vượt giới hạn 2 MB". */
  tooLargeMessage: string;
  /** Mã lỗi `errors[].code` cho lỗi dung lượng và lỗi multipart. */
  codes: { tooLarge: string; invalid: string };
}

const MULTIPART_MESSAGES: ReadonlyArray<[RegExp, string]> = [
  [/^Too many files$/, 'Mỗi lần chỉ được gửi một file'],
  [/^Unexpected field$/, 'File phải được gửi đúng trường của form multipart/form-data'],
  [/^(Too many (fields|parts)|Field (name|value) too long|Field name missing)$/, 'Form gửi lên có quá nhiều trường hoặc trường quá dài'],
];
const MALFORMED_MESSAGE = 'Dữ liệu multipart/form-data không hợp lệ hoặc bị cắt cụt';

/** Lỗi multer/busboy (body tiếng Anh, không có `errors[]`) → envelope chuẩn tiếng Việt, giữ HTTP status. */
export function toUploadException(error: unknown, options: Pick<UploadFileOptions, 'field' | 'tooLargeMessage' | 'codes'>): unknown {
  if (!(error instanceof HttpException)) return error;
  const status = error.getStatus();
  if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
    const message = options.tooLargeMessage;
    return new PayloadTooLargeException({ message, errors: [{ field: options.field, code: options.codes.tooLarge, message }] });
  }
  if (status !== HttpStatus.BAD_REQUEST) return error;
  const message = MULTIPART_MESSAGES.find(([pattern]) => pattern.test(error.message))?.[1] ?? MALFORMED_MESSAGE;
  return new BadRequestException({ message, errors: [{ field: options.field, code: options.codes.invalid, message }] });
}

/**
 * `FileInterceptor(field)` có chuẩn hóa lỗi ở bước đọc multipart (vượt dung lượng, sai field, nhiều
 * file, multipart hỏng). Chỉ bắt lỗi trước khi handler chạy; lỗi của handler đi qua nguyên vẹn.
 */
export function UploadFileInterceptor(options: UploadFileOptions): Type<NestInterceptor> {
  const Base = FileInterceptor(options.field, { limits: options.limits });

  @Injectable()
  class UploadFile extends Base {
    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
      try {
        return await super.intercept(context, next);
      } catch (error) {
        throw toUploadException(error, options);
      }
    }
  }
  return mixin(UploadFile);
}
