import { notifications } from '@mantine/notifications';

/** Helper thông báo nhất quán toàn app. */
export const notify = {
  success(message: string, title = 'Thành công') {
    notifications.show({ color: 'green', title, message });
  },
  error(message: string, title = 'Lỗi') {
    notifications.show({ color: 'red', title, message });
  },
  info(message: string, title?: string) {
    notifications.show({ color: 'blue', title, message });
  },
};
