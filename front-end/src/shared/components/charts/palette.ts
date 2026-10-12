/**
 * Bảng màu categorical cho biểu đồ Dashboard.
 * Đã kiểm định bằng validator của skill dataviz (CVD ΔE ≥ 8, chroma, contrast):
 * - light: ΔE adjacent nhỏ nhất 9.1 (PASS)
 * - dark:  ΔE adjacent nhỏ nhất 8.4 (PASS), contrast ≥ 3:1
 *
 * Thứ tự hue CỐ ĐỊNH, không bao giờ xoay vòng. Màu gắn theo thực thể (status/state),
 * không theo thứ hạng — đổi bộ lọc không được "sơn lại" các mục còn lại.
 */
export const CATEGORICAL_LIGHT = [
  '#2a78d6', // 1 blue
  '#eb6834', // 2 orange
  '#1baf7a', // 3 aqua
  '#eda100', // 4 yellow
  '#e87ba4', // 5 magenta
] as const;

export const CATEGORICAL_DARK = [
  '#3987e5', // 1 blue
  '#d95926', // 2 orange
  '#199e70', // 3 aqua
  '#c98500', // 4 yellow
  '#d55181', // 5 magenta
] as const;

export function categorical(scheme: 'light' | 'dark'): readonly string[] {
  return scheme === 'dark' ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
}

/**
 * Màu cố định theo trạng thái báo cáo (gắn theo thực thể, không theo rank).
 * Index trỏ vào bảng categorical ở trên để giữ CVD-safe.
 */
const REPORT_STATUS_SLOT: Record<string, number> = {
  open: 0, // blue
  in_progress: 3, // yellow
  resolved: 2, // aqua
  dismissed: 4, // magenta
};

export function reportStatusColor(status: string, scheme: 'light' | 'dark'): string {
  const ramp = categorical(scheme);
  const slot = REPORT_STATUS_SLOT[status] ?? 1;
  return ramp[slot] ?? ramp[0];
}
