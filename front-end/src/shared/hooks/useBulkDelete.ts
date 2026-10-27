import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiException } from '@/core/api/api-error';
import { bulkDeleteFailures } from '@/helpers/bulkDelete';
import { confirmAction, notify } from '@/shared/components/feedback';

interface UseBulkDeleteOptions {
  /** Gọi API xóa hàng loạt (back-end xử lý tất cả hoặc không). */
  removeMany: (ids: string[]) => Promise<void>;
  /** Danh từ hiển thị, vd "tài khoản", "phòng". */
  noun: string;
  /** Tên dòng theo ID để liệt kê dòng bị chặn. */
  nameOf: (id: string) => string | undefined;
  onSuccess?: () => void;
  /** Làm mới dữ liệu sau khi xong (thành công hay lỗi). */
  onSettled?: () => unknown;
}

/** Xác nhận → gửi mảng ID → thông báo; lỗi 409 giữ lại danh sách "tên — lý do" để hiện Alert. */
export function useBulkDelete({ removeMany, noun, nameOf, onSuccess, onSettled }: UseBulkDeleteOptions) {
  const [failures, setFailures] = useState<string[] | null>(null);
  const mutation = useMutation({
    mutationFn: removeMany,
    onSuccess: (_result, ids) => {
      notify.success(`Đã xóa ${ids.length} ${noun}`);
      setFailures(null);
      onSuccess?.();
    },
    onError: (error) => {
      const blocked = bulkDeleteFailures(error, nameOf);
      if (blocked) setFailures(blocked);
      else notify.error(error instanceof ApiException ? error.message : `Xóa ${noun} thất bại`);
    },
    onSettled: () => onSettled?.(),
  });

  const confirmDelete = (ids: string[]) => confirmAction({
    title: `Xóa ${ids.length} ${noun}`,
    message: `Xóa ${ids.length} ${noun} đã chọn? Dữ liệu được xóa mềm (ẩn khỏi hệ thống, không mất hẳn). Nếu có mục không xóa được thì không mục nào bị xóa.`,
    danger: true,
    confirmLabel: `Xóa ${ids.length} ${noun}`,
    onConfirm: () => mutation.mutate(ids),
  });

  return { confirmDelete, isPending: mutation.isPending, failures, dismissFailures: () => setFailures(null) };
}
