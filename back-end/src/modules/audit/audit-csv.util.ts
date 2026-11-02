import type { AuditLogResponse } from './dto/audit-log-response.dto';

/** BOM UTF-8 để Excel đọc đúng tiếng Việt có dấu. */
const BOM = '﻿';

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

/**
 * Một ô CSV (RFC 4180): luôn bọc nháy kép, nhân đôi nháy bên trong. Ô bắt đầu bằng `= + - @`, tab
 * hoặc CR bị Excel/Sheets hiểu là công thức (CSV injection) → thêm `'` phía trước. Dữ liệu audit
 * (User-Agent, lý do...) do người ngoài gửi lên nên không được tin.
 */
export function csvCell(value: string | null): string {
  if (value === null) return '""';
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Toàn bộ file CSV nhật ký: BOM + dòng tiêu đề + mỗi bản ghi một dòng, ngắt dòng CRLF. */
export function toAuditCsv(rows: AuditLogResponse[]): string {
  const lines = [COLUMNS.map(([header]) => csvCell(header)).join(',')];
  for (const row of rows) {
    lines.push(COLUMNS.map(([, value]) => csvCell(value(row))).join(','));
  }
  return `${BOM}${lines.join('\r\n')}\r\n`;
}
