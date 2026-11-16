import { CSV_BOM, csvCell } from '../../common/utils/csv.util';
import type { AuditLogResponse } from './dto/audit-log-response.dto';

// Giữ export cũ cho test/nơi đang import từ đây.
export { csvCell };

const COLUMNS: [header: string, value: (row: AuditLogResponse) => string | null][] = [
  ['Thời điểm (UTC)', (r) => r.occurredAt.toISOString()],
  ['Hành động', (r) => r.action],
  ['Đối tượng', (r) => r.resourceType],
  ['ID đối tượng', (r) => r.resourceId],
  ['Email người thực hiện', (r) => r.actor?.email ?? null],
  ['Tên người thực hiện', (r) => r.actor?.displayName ?? null],
  ['ID người thực hiện', (r) => r.actorId],
  ['Lý do / Chi tiết', (r) => r.reason],
  ['IP', (r) => r.ip],
  ['User-Agent', (r) => r.userAgent],
  ['Request ID', (r) => r.requestId],
  ['ID phiên bản', (r) => r.revisionId],
  ['ID bản ghi', (r) => r.id],
];

/** Toàn bộ file CSV nhật ký: BOM + dòng tiêu đề + mỗi bản ghi một dòng, ngắt dòng CRLF. */
export function toAuditCsv(rows: AuditLogResponse[]): string {
  const lines = [COLUMNS.map(([header]) => csvCell(header)).join(',')];
  for (const row of rows) {
    lines.push(COLUMNS.map(([, value]) => csvCell(value(row))).join(','));
  }
  return `${CSV_BOM}${lines.join('\r\n')}\r\n`;
}
