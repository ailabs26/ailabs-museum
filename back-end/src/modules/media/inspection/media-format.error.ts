/** Mã lỗi trả về client trong `errors[].code` khi upload bị từ chối. */
export enum MediaErrorCode {
  FILE_REQUIRED = 'media_file_required',
  EMPTY_FILE = 'media_empty_file',
  UNSUPPORTED_TYPE = 'media_unsupported_type',
  MARKUP_REJECTED = 'media_markup_rejected',
  CORRUPTED = 'media_corrupted',
  KIND_MISMATCH = 'media_kind_mismatch',
  TOO_LARGE = 'media_too_large',
  QUARANTINED = 'media_quarantined',
}

/**
 * Lỗi có chủ đích khi file không đạt kiểm tra định dạng/cấu trúc. Mọi lỗi KHÁC phát sinh
 * trong lúc phân tích file được coi là "không rõ nguyên nhân" và đưa file vào quarantine.
 */
export class MediaFormatError extends Error {
  constructor(
    readonly code: MediaErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MediaFormatError';
  }
}

/** Lỗi cấu trúc file (magic bytes đúng nhưng nội dung hỏng). */
export function corrupted(message: string): MediaFormatError {
  return new MediaFormatError(MediaErrorCode.CORRUPTED, message);
}
