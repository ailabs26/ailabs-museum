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
import { Observable } from 'rxjs';
import { MediaErrorCode } from '../inspection/media-format.error';
import { MAX_UPLOAD_BYTES, MEGABYTE } from '../inspection/media-formats';

/**
 * Giới hạn multer cho mọi route upload media (đồng bộ và job) → 413 khi vượt. Busboy coi file dài
 * ĐÚNG bằng `fileSize` là vượt giới hạn, nên cộng 1 byte để file đúng 10 MB (SRS: "≤ 10 MB") vẫn
 * qua được; giới hạn chính xác theo định dạng thực tế do MediaService kiểm tra.
 */
export const MEDIA_UPLOAD_LIMITS = {
  fileSize: MAX_UPLOAD_BYTES + 1,
  files: 1,
  fields: 10,
  fieldSize: 16 * 1024,
  parts: 12,
};

const MULTIPART_MESSAGES: ReadonlyArray<[RegExp, string]> = [
  [/^Too many files$/, 'Mỗi lần chỉ được tải lên một file'],
  [/^Unexpected field$/, 'File phải được gửi trong trường "file" của form multipart/form-data'],
  [/^(Too many (fields|parts)|Field (name|value) too long|Field name missing)$/, 'Form tải lên có quá nhiều trường hoặc trường quá dài'],
];
const MALFORMED_MESSAGE = 'Dữ liệu multipart/form-data không hợp lệ hoặc bị cắt cụt';

/**
 * Lỗi do multer/busboy ném ra (vượt dung lượng, sai field, multipart hỏng) có body mặc định tiếng
 * Anh và không có `errors[]` (vd `{ message: 'File too large' }`), khác hẳn lỗi do MediaService ném.
 * Chuẩn hóa về cùng envelope `{ message, errors: [{ field: 'file', code, message }] }`, giữ nguyên HTTP status.
 */
export function toMediaUploadException(error: unknown): unknown {
  if (!(error instanceof HttpException)) return error;
  const status = error.getStatus();
  if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
    const message = `File vượt giới hạn tải lên tối đa ${MAX_UPLOAD_BYTES / MEGABYTE} MB`;
    return new PayloadTooLargeException({ message, errors: [{ field: 'file', code: MediaErrorCode.TOO_LARGE, message }] });
  }
  if (status !== HttpStatus.BAD_REQUEST) return error;
  const original = error.message;
  const message = MULTIPART_MESSAGES.find(([pattern]) => pattern.test(original))?.[1] ?? MALFORMED_MESSAGE;
  return new BadRequestException({ message, errors: [{ field: 'file', code: MediaErrorCode.INVALID_MULTIPART, message }] });
}

/**
 * `FileInterceptor('file')` với giới hạn media, chuẩn hóa lỗi ở bước đọc multipart.
 * Chỉ bắt lỗi của bước multer (trước khi handler chạy); lỗi của handler đi qua nguyên vẹn.
 */
export function MediaFileInterceptor(): Type<NestInterceptor> {
  const Base = FileInterceptor('file', { limits: MEDIA_UPLOAD_LIMITS });

  @Injectable()
  class MediaFile extends Base {
    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
      try {
        return await super.intercept(context, next);
      } catch (error) {
        throw toMediaUploadException(error);
      }
    }
  }
  return mixin(MediaFile);
}
