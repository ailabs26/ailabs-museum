/**
 * Kho lưu tạm phía client (localStorage) cho các tính năng CMS chưa có endpoint
 * backend — hiện phục vụ Bản dịch đa ngôn ngữ và API Key đối tác.
 *
 * Mục tiêu: dựng UI hoàn chỉnh theo đúng tầng service + react-query như phần còn
 * lại của app, để khi backend sẵn sàng chỉ cần thay thân hàm service bằng lời gọi
 * `http.*`. Mọi truy cập storage đều bọc try/catch và mô phỏng độ trễ mạng nhẹ để
 * trạng thái loading/optimistic hiển thị đúng.
 */
const PREFIX = 'aura.cms.';

/** Mô phỏng độ trễ mạng để UI thể hiện trạng thái pending như gọi API thật. */
function delay<T>(value: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function safeParse<T>(raw: string | null): T[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

/** Đọc cả tập; nếu chưa có thì gieo dữ liệu mẫu rồi lưu lại. */
export async function readCollection<T>(key: string, seed: () => T[]): Promise<T[]> {
  const storageKey = PREFIX + key;
  let rows: T[] | null = null;
  try {
    rows = safeParse<T>(localStorage.getItem(storageKey));
  } catch {
    rows = null;
  }
  if (!rows) {
    rows = seed();
    try {
      localStorage.setItem(storageKey, JSON.stringify(rows));
    } catch {
      /* chế độ riêng tư / hết quota: vẫn trả dữ liệu mẫu trong bộ nhớ */
    }
  }
  return delay(rows);
}

/** Ghi đè cả tập. */
export async function writeCollection<T>(key: string, rows: T[]): Promise<T[]> {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(rows));
  } catch {
    /* bỏ qua lỗi ghi: UI vẫn phản ánh trạng thái mới trong phiên hiện tại */
  }
  return delay(rows);
}

/** Sinh id ngắn, đủ duy nhất cho dữ liệu demo phía client. */
export function makeId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
