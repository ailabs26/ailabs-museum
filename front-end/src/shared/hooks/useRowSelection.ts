import { useEffect, useState } from 'react';

/**
 * Giữ ID các dòng đang chọn. Tự bỏ chọn khi `resetKey` đổi (trang, bộ lọc, từ khóa…) để không xóa nhầm
 * dòng không còn hiển thị.
 */
export function useRowSelection(resetKey: string) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  useEffect(() => {
    setSelectedIds([]);
  }, [resetKey]);
  return { selectedIds, setSelectedIds, clear: () => setSelectedIds([]) };
}
