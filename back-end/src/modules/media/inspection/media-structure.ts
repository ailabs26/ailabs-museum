import { MediaFormat } from './media-formats';
import { validateGlb } from './validators/glb.validator';
import { validateJpeg } from './validators/jpeg.validator';
import { validateMp3 } from './validators/mp3.validator';
import { validatePng } from './validators/png.validator';
import { validateVtt } from './validators/vtt.validator';
import { validateWebp } from './validators/webp.validator';

const STRUCTURE_VALIDATORS: Readonly<Record<MediaFormat, (buffer: Buffer) => void>> = {
  [MediaFormat.GLB]: validateGlb,
  [MediaFormat.JPEG]: validateJpeg,
  [MediaFormat.PNG]: validatePng,
  [MediaFormat.WEBP]: validateWebp,
  [MediaFormat.MP3]: validateMp3,
  [MediaFormat.VTT]: validateVtt,
};

/**
 * Parse/kiểm tra cấu trúc file theo định dạng đã nhận diện từ magic bytes.
 * Ném `MediaFormatError` khi file hỏng; lỗi loại khác nghĩa là "không rõ nguyên nhân".
 */
export function validateMediaStructure(format: MediaFormat, buffer: Buffer): void {
  STRUCTURE_VALIDATORS[format](buffer);
}
