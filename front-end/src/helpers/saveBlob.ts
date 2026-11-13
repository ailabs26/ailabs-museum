/** Lưu Blob thành file tải về trình duyệt với tên cho trước. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Thu hồi sau khi trình duyệt đã bắt đầu tải (thu hồi ngay có thể hủy tải trên một số trình duyệt).
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Tên file từ `Content-Disposition: attachment; filename="..."`; thiếu thì dùng tên mặc định. */
export function filenameFromDisposition(header: unknown, fallback: string): string {
  const match = typeof header === 'string' ? /filename="([^"]+)"/.exec(header) : null;
  return match?.[1] ?? fallback;
}
