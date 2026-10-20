import { IsOptional, IsString } from 'class-validator';

export interface PublishValidationInput {
  name?: { vi?: string | null; en?: string | null } | string | null;
  description?: { vi?: string | null; en?: string | null } | string | null;
  position?: { x?: number | null; y?: number | null; z?: number | null } | null;
  rotation?: { x?: number | null; y?: number | null; z?: number | null } | null;
  scale?: { x?: number | null; y?: number | null; z?: number | null } | null;
  positionX?: number | null;
  positionY?: number | null;
  positionZ?: number | null;
  rotationX?: number | null;
  rotationY?: number | null;
  rotationZ?: number | null;
  scaleX?: number | null;
  scaleY?: number | null;
  scaleZ?: number | null;
  audioId?: string | null;
  transcript?: { vi?: string | null; en?: string | null } | string | null;
  imageId?: string | null;
  altText?: { vi?: string | null; en?: string | null } | string | null;
  hotspots?: Array<{
    label?: { vi?: string | null; en?: string | null } | string | null;
    body?: { vi?: string | null; en?: string | null } | string | null;
    positionX?: number | null;
    positionY?: number | null;
    positionZ?: number | null;
  }> | null;
}

export interface PublishValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * DTO khi gửi yêu cầu Publish (có thể kèm ghi chú hoặc lý do)
 */
export class PublishExhibitDto {
  @IsOptional()
  @IsString({ message: 'Ghi chú duyệt phải là chuỗi' })
  reason?: string;
}

/**
 * Kiểm tra các ràng buộc bắt buộc khi Publish theo SRS Mục 5.2
 */
export function validateForPublish(
  input: PublishValidationInput,
): PublishValidationResult {
  const errors: string[] = [];

  // 1. Tên hiện vật: Bắt buộc 1–200 ký tự không rỗng cho cả vi và en
  const nameVi =
    typeof input.name === 'string'
      ? input.name.trim()
      : typeof input.name?.vi === 'string'
        ? input.name.vi.trim()
        : '';
  const nameEn =
    typeof input.name === 'object' && typeof input.name?.en === 'string'
      ? input.name.en.trim()
      : '';

  if (!nameVi || nameVi.length < 1 || nameVi.length > 200) {
    errors.push('name.vi: Tên tiếng Việt bắt buộc từ 1 đến 200 ký tự (không rỗng sau trim)');
  }
  if (!nameEn || nameEn.length < 1 || nameEn.length > 200) {
    errors.push('name.en: Tên tiếng Anh bắt buộc từ 1 đến 200 ký tự (không rỗng sau trim)');
  }

  // 2. Mô tả hiện vật: Bắt buộc 1–10.000 ký tự không rỗng cho cả vi và en
  const descVi =
    typeof input.description === 'string'
      ? input.description.trim()
      : typeof input.description?.vi === 'string'
        ? input.description.vi.trim()
        : '';
  const descEn =
    typeof input.description === 'object' && typeof input.description?.en === 'string'
      ? input.description.en.trim()
      : '';

  if (!descVi || descVi.length < 1 || descVi.length > 10000) {
    errors.push('description.vi: Mô tả tiếng Việt bắt buộc từ 1 đến 10.000 ký tự');
  }
  if (!descEn || descEn.length < 1 || descEn.length > 10000) {
    errors.push('description.en: Mô tả tiếng Anh bắt buộc từ 1 đến 10.000 ký tự');
  }

  // 3. Tọa độ Position: Số hữu hạn, Y hướng lên
  const posX = input.position?.x ?? input.positionX ?? 0;
  const posY = input.position?.y ?? input.positionY ?? 0;
  const posZ = input.position?.z ?? input.positionZ ?? 0;
  if (!Number.isFinite(posX) || !Number.isFinite(posY) || !Number.isFinite(posZ)) {
    errors.push('position: Tọa độ positionX/Y/Z phải là các số hữu hạn');
  }

  // 4. Góc xoay Rotation: Số hữu hạn (radian)
  const rotX = input.rotation?.x ?? input.rotationX ?? 0;
  const rotY = input.rotation?.y ?? input.rotationY ?? 0;
  const rotZ = input.rotation?.z ?? input.rotationZ ?? 0;
  if (!Number.isFinite(rotX) || !Number.isFinite(rotY) || !Number.isFinite(rotZ)) {
    errors.push('rotation: Góc xoay rotationX/Y/Z phải là các số hữu hạn');
  }

  // 5. Tỉ lệ Scale: Số hữu hạn và TỪNG TRỤC PHẢI > 0
  const scaleX = input.scale?.x ?? input.scaleX ?? 1;
  const scaleY = input.scale?.y ?? input.scaleY ?? 1;
  const scaleZ = input.scale?.z ?? input.scaleZ ?? 1;
  if (
    !Number.isFinite(scaleX) ||
    !Number.isFinite(scaleY) ||
    !Number.isFinite(scaleZ) ||
    scaleX <= 0 ||
    scaleY <= 0 ||
    scaleZ <= 0
  ) {
    errors.push('scale: Tỉ lệ scaleX/Y/Z phải là các số hữu hạn và lớn hơn 0');
  }

  // 6. Ràng buộc Audio: Nếu có audioId thì bắt buộc phải có transcript không rỗng
  if (input.audioId) {
    const transcriptText =
      typeof input.transcript === 'string'
        ? input.transcript.trim()
        : typeof input.transcript?.vi === 'string'
          ? input.transcript.vi.trim()
          : typeof input.transcript?.en === 'string'
            ? input.transcript.en.trim()
            : '';
    if (!transcriptText) {
      errors.push('audio: Hiện vật có audio bắt buộc phải cung cấp transcript không rỗng');
    }
  }

  // 7. Ràng buộc Image: Nếu có imageId thì bắt buộc phải có altText song ngữ vi và en
  if (input.imageId) {
    const altVi =
      typeof input.altText === 'string'
        ? input.altText.trim()
        : typeof input.altText?.vi === 'string'
          ? input.altText.vi.trim()
          : '';
    const altEn =
      typeof input.altText === 'object' && typeof input.altText?.en === 'string'
        ? input.altText.en.trim()
        : '';
    if (!altVi) {
      errors.push('imageId: Hình ảnh đính kèm bắt buộc phải có altText.vi');
    }
    if (!altEn) {
      errors.push('imageId: Hình ảnh đính kèm bắt buộc phải có altText.en');
    }
  }

  // 8. Ràng buộc Hotspots: Nếu có hotspots, kiểm tra tiêu đề 1–200 và nội dung 1–5.000 ký tự cho cả vi/en
  if (input.hotspots && input.hotspots.length > 0) {
    input.hotspots.forEach((hs, idx) => {
      const labelVi =
        typeof hs.label === 'string'
          ? hs.label.trim()
          : typeof hs.label?.vi === 'string'
            ? hs.label.vi.trim()
            : '';
      const labelEn =
        typeof hs.label === 'object' && typeof hs.label?.en === 'string'
          ? hs.label.en.trim()
          : '';
      const bodyVi =
        typeof hs.body === 'string'
          ? hs.body.trim()
          : typeof hs.body?.vi === 'string'
            ? hs.body.vi.trim()
            : '';
      const bodyEn =
        typeof hs.body === 'object' && typeof hs.body?.en === 'string'
          ? hs.body.en.trim()
          : '';

      if (!labelVi || labelVi.length > 200) {
        errors.push(`hotspots[${idx}].label.vi: Tiêu đề hotspot tiếng Việt bắt buộc từ 1 đến 200 ký tự`);
      }
      if (!labelEn || labelEn.length > 200) {
        errors.push(`hotspots[${idx}].label.en: Tiêu đề hotspot tiếng Anh bắt buộc từ 1 đến 200 ký tự`);
      }
      if (!bodyVi || bodyVi.length > 5000) {
        errors.push(`hotspots[${idx}].body.vi: Nội dung hotspot tiếng Việt bắt buộc từ 1 đến 5.000 ký tự`);
      }
      if (!bodyEn || bodyEn.length > 5000) {
        errors.push(`hotspots[${idx}].body.en: Nội dung hotspot tiếng Anh bắt buộc từ 1 đến 5.000 ký tự`);
      }

      const hx = hs.positionX ?? 0;
      const hy = hs.positionY ?? 0;
      const hz = hs.positionZ ?? 0;
      if (!Number.isFinite(hx) || !Number.isFinite(hy) || !Number.isFinite(hz)) {
        errors.push(`hotspots[${idx}].position: Tọa độ hotspot phải là số hữu hạn`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

