/** Lỗi theo field mà API trả (`errors[]` trong ApiResponse). */
export interface FieldApiError {
  field?: string;
  code: string;
  message: string;
}

export type ExhibitFormTab = 'basic' | 'transform' | 'media';

/**
 * Field của API (DTO / cổng Submit Review §5.2) → field của form hiện vật trong CMS.
 * Field không có trong bảng (vd hotspot) được gom vào `general` để vẫn hiện cho người dùng.
 */
const FIELD_MAP: Record<string, string> = {
  'name.vi': 'nameVi',
  'name.en': 'nameEn',
  'description.vi': 'descriptionVi',
  'description.en': 'descriptionEn',
  position: 'positionX',
  rotation: 'rotationX',
  scale: 'scaleX',
  modelId: 'modelId',
  imageId: 'imageId',
  audioId: 'audioViId',
  audioViId: 'audioViId',
  audioEnId: 'audioEnId',
  subtitleViId: 'subtitleViId',
  subtitleEnId: 'subtitleEnId',
  'altText.vi': 'altTextVi',
  'altText.en': 'altTextEn',
  'transcript.vi': 'transcriptVi',
  'transcript.en': 'transcriptEn',
  // validateForPublish: "audio: cần transcript" (luật cũ, áp cho audio tiếng Việt).
  audio: 'transcriptVi',
};

const TAB_OF_FIELD: Record<string, ExhibitFormTab> = {
  nameVi: 'basic',
  nameEn: 'basic',
  descriptionVi: 'basic',
  descriptionEn: 'basic',
  positionX: 'transform',
  rotationX: 'transform',
  scaleX: 'transform',
  scaleY: 'transform',
  scaleZ: 'transform',
};

export interface MappedExhibitErrors {
  /** Lỗi gắn được vào ô nhập; nhiều lỗi cùng ô được nối bằng "; ". */
  fieldErrors: Record<string, string>;
  /** Lỗi không gắn được vào ô nào. */
  general: string[];
  /** Tab đầu tiên có lỗi theo thứ tự hiển thị — để chuyển tab cho người dùng thấy ngay. */
  firstTab: ExhibitFormTab | null;
}

export function mapExhibitErrors(errors: readonly FieldApiError[]): MappedExhibitErrors {
  const fieldErrors: Record<string, string> = {};
  const general: string[] = [];
  for (const error of errors) {
    const formField = error.field ? FIELD_MAP[error.field] : undefined;
    if (!formField) {
      general.push(error.field ? `${error.field}: ${error.message}` : error.message);
      continue;
    }
    fieldErrors[formField] = fieldErrors[formField] ? `${fieldErrors[formField]}; ${error.message}` : error.message;
  }
  return { fieldErrors, general, firstTab: firstTabWithError(Object.keys(fieldErrors)) };
}

const BASIC_FIELDS = new Set(['roomId', 'displayOrder']);
const MEDIA_FIELDS = new Set(Object.values(FIELD_MAP).filter((field) => !(field in TAB_OF_FIELD)));

/**
 * Tab đầu tiên (theo thứ tự hiển thị) chứa một trong các field form có lỗi — dùng cho cả lỗi
 * của API lẫn lỗi validate phía client (vd chưa chọn phòng khi đang đứng ở tab Media).
 */
export function firstTabWithError(formFields: readonly string[]): ExhibitFormTab | null {
  const tabs = new Set(
    formFields.map((field) =>
      TAB_OF_FIELD[field] ?? (BASIC_FIELDS.has(field) ? 'basic' : MEDIA_FIELDS.has(field) ? 'media' : 'transform'),
    ),
  );
  return (['basic', 'transform', 'media'] as const).find((tab) => tabs.has(tab)) ?? null;
}
