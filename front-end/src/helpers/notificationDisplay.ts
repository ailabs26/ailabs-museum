const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "Vừa xong", "5 phút trước", "3 giờ trước", "2 ngày trước"; quá 7 ngày thì hiện ngày tháng. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  if (diff < MINUTE) return 'Vừa xong';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} phút trước`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} giờ trước`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

/** Ngưỡng ký tự ≈ 2 dòng trong popover; dài hơn (hoặc nhiều dòng) thì cắt và hiện "Xem thêm". */
export const BODY_PREVIEW_CHARS = 100;

export function isLongBody(body: string | null): boolean {
  if (!body) return false;
  return body.length > BODY_PREVIEW_CHARS || body.split('\n').length > 2;
}
