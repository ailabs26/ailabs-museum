/** Một dòng so sánh field giữa phiên bản đã xuất bản và revision đang xét. */
export interface DiffFieldDto {
  field: string;
  label: string;
  oldValue: string | null;
  newValue: string | null;
  changed: boolean;
}

/** Kết quả so sánh cũ/mới cho một revision. */
export interface RevisionDiffDto {
  revisionId: string;
  exhibitId: string;
  /** revisionNo của bản đang xuất bản (null nếu hiện vật chưa từng xuất bản). */
  publishedRevisionNo: number | null;
  /** revisionNo của bản đang xét. */
  targetRevisionNo: number;
  fields: DiffFieldDto[];
}
