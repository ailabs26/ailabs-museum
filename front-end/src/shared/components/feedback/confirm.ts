import { modals } from '@mantine/modals';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

/** Mở modal xác nhận hành động (xóa, khóa...). */
export function confirmAction({
  title = 'Xác nhận',
  message,
  confirmLabel = 'Đồng ý',
  cancelLabel = 'Hủy',
  danger = false,
  onConfirm,
}: ConfirmOptions) {
  modals.openConfirmModal({
    title,
    children: message,
    labels: { confirm: confirmLabel, cancel: cancelLabel },
    confirmProps: { color: danger ? 'red' : undefined },
    onConfirm: () => void onConfirm(),
  });
}
