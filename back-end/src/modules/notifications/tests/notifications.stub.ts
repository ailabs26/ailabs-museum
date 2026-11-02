import type { NotificationsService } from '../services/notifications.service';

type Notifier = Pick<NotificationsService, 'revisionSubmitted' | 'revisionReviewed' | 'reportCreated'>;

/** NotificationsService giả cho test của module khác: không ghi DB, ghi lại lời gọi để kiểm tra. */
export function notificationsStub() {
  const calls: { method: keyof Notifier; input: unknown }[] = [];
  const record = (method: keyof Notifier) => async (input: unknown) => { calls.push({ method, input }); };
  const stub = {
    revisionSubmitted: record('revisionSubmitted'),
    revisionReviewed: record('revisionReviewed'),
    reportCreated: record('reportCreated'),
  };
  return Object.assign(stub as unknown as NotificationsService, { calls });
}
