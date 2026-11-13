import { http } from '@/core/api/http-client';
import type { Page } from '@/core/api/api-response';

export type NotificationType = 'revision.submitted' | 'revision.approved' | 'revision.rejected' | 'report.created' | 'report.assigned';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  /** Chi tiết (lý do từ chối, nội dung báo cáo) — có thể dài. */
  body: string | null;
  /** Đường dẫn trong CMS để mở khi bấm. */
  link: string | null;
  read: boolean;
  createdAt: string;
}

export const notificationsService = {
  list(page: number, pageSize: number): Promise<Page<NotificationItem>> {
    return http.getPage<NotificationItem>('/notifications', { params: { page, pageSize } });
  },
  unreadCount(): Promise<{ count: number }> {
    return http.get<{ count: number }>('/notifications/unread-count');
  },
  markRead(id: string): Promise<null> {
    return http.patch<null>(`/notifications/${id}/read`);
  },
  markAllRead(): Promise<{ updated: number }> {
    return http.post<{ updated: number }>('/notifications/read-all');
  },
  remove(id: string): Promise<null> {
    return http.delete<null>(`/notifications/${id}`);
  },
};
