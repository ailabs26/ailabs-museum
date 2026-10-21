/** Phần tử tối thiểu để sắp thứ tự tour (khớp `ExhibitRow`). */
export interface TourOrderItem {
  id: string;
  displayOrder: number;
}

/** Thứ tự tour hiện tại — cùng quy tắc tour công khai (`mapRoomDisplays`): displayOrder rồi id. */
export function sortForTour<T extends TourOrderItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.displayOrder - b.displayOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Chuyển phần tử ở vị trí `from` tới `to` (kéo-thả hoặc nút lên/xuống); chỉ số ngoài phạm vi → giữ nguyên. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Thứ tự đã đổi so với ban đầu chưa — để bật/tắt nút lưu. */
export function isOrderChanged(original: readonly TourOrderItem[], current: readonly TourOrderItem[]): boolean {
  return original.length !== current.length || original.some((item, index) => item.id !== current[index].id);
}
