/** Kết quả truy vấn có phân trang — trả về từ repository, map sang ApiResponse.meta. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Nhận diện một giá trị là Paginated (dùng trong ResponseInterceptor). */
export function isPaginated<T = unknown>(value: unknown): value is Paginated<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'items' in value &&
    'total' in value &&
    'page' in value &&
    'pageSize' in value &&
    Array.isArray((value as Paginated<T>).items)
  );
}
