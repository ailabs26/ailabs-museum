import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiException } from '@/core/api/api-error';
import { bulkDeleteFailures, type BulkAction } from '@/helpers/bulkDelete';
import { confirmAction, notify } from '@/shared/components/feedback';

interface UseBulkActionOptions {
  /** Gọi API hàng loạt (back-end xử lý tất cả hoặc không). */
  run: (ids: string[]) => Promise<void>;
  /** Danh từ hiển thị, vd "tài khoản", "phòng". */
  noun: string;
  /** Tên dòng theo ID để liệt kê dòng bị chặn. */
  nameOf: (id: string) => string | undefined;
  onSuccess?: () => void;
  /** Làm mới dữ liệu sau khi xong (thành công hay lỗi). */
  onSettled?: () => unknown;
}

const TEXT: Record<BulkAction, {
  verb: string; done: string; message: (count: number, noun: string) => string; danger: boolean;
}> = {
  delete: {
    verb: 'Xóa',
    done: 'Đã xóa',
    message: (count, noun) => `Xóa ${count} ${noun} đã chọn? Dữ liệu được xóa mềm (chuyển vào mục Đã xóa, khôi phục được). Nếu có mục không xóa được thì không mục nào bị xóa.`,
    danger: true,
  },
  restore: {
    verb: 'Khôi phục',
    done: 'Đã khôi phục',
    message: (count, noun) => `Khôi phục ${count} ${noun} đã chọn về danh sách đang dùng? Nếu có mục không khôi phục được thì không mục nào được khôi phục.`,
    danger: false,
  },
};

/** Xác nhận → gửi mảng ID → thông báo; lỗi 409 giữ lại danh sách "tên — lý do" để hiện Alert. */
function useBulkAction(action: BulkAction, { run, noun, nameOf, onSuccess, onSettled }: UseBulkActionOptions) {
  const text = TEXT[action];
  const [failures, setFailures] = useState<string[] | null>(null);
  const mutation = useMutation({
    mutationFn: run,
    onSuccess: (_result, ids) => {
      notify.success(`${text.done} ${ids.length} ${noun}`);
      setFailures(null);
      onSuccess?.();
    },
    onError: (error) => {
      const blocked = bulkDeleteFailures(error, nameOf, action);
      if (blocked) setFailures(blocked);
      else notify.error(error instanceof ApiException ? error.message : `${text.verb} ${noun} thất bại`);
    },
    onSettled: () => onSettled?.(),
  });

  const confirm = (ids: string[]) => confirmAction({
    title: `${text.verb} ${ids.length} ${noun}`,
    message: text.message(ids.length, noun),
    danger: text.danger,
    confirmLabel: `${text.verb} ${ids.length} ${noun}`,
    onConfirm: () => mutation.mutate(ids),
  });

  return { confirm, isPending: mutation.isPending, failures, dismissFailures: () => setFailures(null) };
}

/** Xóa mềm hàng loạt (tất cả hoặc không). */
export function useBulkDelete({ removeMany, ...options }: Omit<UseBulkActionOptions, 'run'> & { removeMany: (ids: string[]) => Promise<void> }) {
  const { confirm, ...rest } = useBulkAction('delete', { run: removeMany, ...options });
  return { confirmDelete: confirm, ...rest };
}

/** Khôi phục hàng loạt từ mục Đã xóa (tất cả hoặc không). */
export function useBulkRestore({ restoreMany, ...options }: Omit<UseBulkActionOptions, 'run'> & { restoreMany: (ids: string[]) => Promise<void> }) {
  const { confirm, ...rest } = useBulkAction('restore', { run: restoreMany, ...options });
  return { confirmRestore: confirm, ...rest };
}
