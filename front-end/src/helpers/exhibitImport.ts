import { IMPORT_MAX_BYTES, type ImportExhibitsResult, type ImportRowResult } from '@/services/exhibits.service';

/** Kiểm tra sớm ở trình duyệt (đuôi + dung lượng); back-end vẫn là chốt chặn thật. */
export function importFileProblem(file: Pick<File, 'name' | 'size'> | null): string | null {
  if (!file) return null;
  if (!/\.(csv|json)$/i.test(file.name)) return 'Chỉ nhận file .csv hoặc .json';
  if (file.size === 0) return 'File rỗng';
  if (file.size > IMPORT_MAX_BYTES) return `File vượt giới hạn ${IMPORT_MAX_BYTES / 1_000_000} MB`;
  return null;
}

/** Một lỗi → chuỗi hiển thị; bỏ tiền tố tên trường khi thông điệp đã nhắc tới trường đó (tránh "x: x phải…"). */
function describeError({ field, message }: { field: string; message: string }): string {
  return field === 'row' || message.includes(field) ? message : `${field}: ${message}`;
}

/** Dòng lỗi kèm danh sách lỗi đã gộp thành một chuỗi để hiển thị trong bảng. */
export function errorRows(result: ImportExhibitsResult): Array<ImportRowResult & { message: string }> {
  return result.rows
    .filter((row) => row.status === 'error')
    .map((row) => ({ ...row, message: row.errors.map(describeError).join(' · ') }));
}

/** Tóm tắt một dòng cho thông báo/Alert. */
export function importSummary(result: ImportExhibitsResult): string {
  if (result.dryRun) {
    return result.failed === 0
      ? `Cả ${result.total} dòng đều hợp lệ.`
      : `${result.valid}/${result.total} dòng hợp lệ, ${result.failed} dòng lỗi (sẽ bị bỏ qua khi nhập).`;
  }
  return result.failed === 0
    ? `Đã tạo ${result.created} bản nháp hiện vật.`
    : `Đã tạo ${result.created} bản nháp; ${result.failed} dòng lỗi chưa được nhập.`;
}
