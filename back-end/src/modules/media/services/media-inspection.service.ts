import { Injectable } from '@nestjs/common';
import { MediaErrorCode, MediaFormatError } from '../inspection/media-format.error';
import { MEDIA_FORMAT_SPECS, MediaFormatSpec } from '../inspection/media-formats';
import { detectMediaFormat, looksLikeMarkup } from '../inspection/media-signature';
import { validateMediaStructure } from '../inspection/media-structure';

/** Nhận diện và kiểm tra nội dung file upload — chỉ dựa trên byte thực tế (NFR-19). */
@Injectable()
export class MediaInspectionService {
  /** Xác định định dạng từ magic bytes; ném `MediaFormatError` nếu rỗng/không được phép. */
  identify(buffer: Buffer): MediaFormatSpec {
    if (buffer.length === 0) {
      throw new MediaFormatError(MediaErrorCode.EMPTY_FILE, 'File rỗng (0 byte)');
    }
    const format = detectMediaFormat(buffer);
    if (format) return MEDIA_FORMAT_SPECS[format];

    if (looksLikeMarkup(buffer)) {
      throw new MediaFormatError(
        MediaErrorCode.MARKUP_REJECTED,
        'Không chấp nhận SVG, HTML, XML hoặc script — các định dạng này có thể chứa mã độc',
      );
    }
    throw new MediaFormatError(
      MediaErrorCode.UNSUPPORTED_TYPE,
      'Định dạng file không được hỗ trợ. Chấp nhận: GLB, JPEG, PNG, WebP, MP3, WebVTT',
    );
  }

  /** Parse/decode theo định dạng; ném `MediaFormatError` nếu file hỏng. */
  validateStructure(spec: MediaFormatSpec, buffer: Buffer): void {
    validateMediaStructure(spec.format, buffer);
  }
}
