/** BOM UTF-8 để Excel đọc đúng tiếng Việt có dấu. */
export const CSV_BOM = '﻿';

/**
 * Ký tự đầu ô mà Excel/Sheets hiểu là công thức (CSV injection), cộng thêm chính dấu `'` để việc
 * thêm/bỏ tiền tố luôn khôi phục đúng giá trị gốc (`'-abc` xuất thành `''-abc`, nhập lại ra `'-abc`).
 */
const GUARDED_PREFIX = /^[=+\-@\t\r']/;

/**
 * Một ô CSV (RFC 4180): luôn bọc nháy kép, nhân đôi nháy bên trong. Mặc định ô bắt đầu bằng
 * `= + - @`, tab, CR hoặc `'` được thêm `'` phía trước để không bị chạy như công thức. Cột số (vd tọa
 * độ âm `-4`) truyền `guardFormula: false` để giữ nguyên giá trị khi nhập ngược lại.
 */
export function csvCell(value: string | null, options: { guardFormula?: boolean } = {}): string {
  if (value === null) return '""';
  const safe = options.guardFormula !== false && GUARDED_PREFIX.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * Bỏ dấu `'` do `csvCell` thêm vào (ngược lại của guard). Chỉ bỏ khi ký tự kế tiếp thuộc nhóm được
 * guard, nên file người dùng tự gõ `'Ngọc' của vua` vẫn giữ nguyên.
 */
export function unguardCsvText(value: string): string {
  return value.startsWith("'") && GUARDED_PREFIX.test(value.slice(1)) ? value.slice(1) : value;
}

export class CsvParseError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(message);
    this.name = 'CsvParseError';
  }
}

/**
 * Parse CSV theo RFC 4180: dấu phẩy, ô bọc nháy kép (nháy kép đôi = một nháy), xuống dòng trong ô
 * có nháy, ngắt dòng CRLF hoặc LF, bỏ BOM đầu file. Dòng trống hoàn toàn bị bỏ qua.
 * Ném `CsvParseError` (kèm số dòng) khi nháy kép không đóng hoặc có ký tự sau nháy đóng.
 */
export function parseCsv(text: string): string[][] {
  const input = text.startsWith(CSV_BOM) ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let afterQuote = false;
  let line = 1;
  let quoteLine = 1;

  const endCell = () => {
    row.push(cell);
    cell = '';
    afterQuote = false;
  };
  const endRow = () => {
    endCell();
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        if (char === '\n') line += 1;
        cell += char;
      }
      continue;
    }
    if (char === ',') {
      endCell();
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      endRow();
      line += 1;
    } else if (afterQuote) {
      throw new CsvParseError(`Dòng ${line}: có ký tự sau dấu nháy kép đóng ô`, line);
    } else if (char === '"' && cell === '') {
      quoted = true;
      quoteLine = line;
    } else {
      cell += char;
    }
  }
  if (quoted) throw new CsvParseError(`Dòng ${quoteLine}: dấu nháy kép mở ô nhưng không đóng`, quoteLine);
  if (cell !== '' || row.length > 0) endRow();
  return rows;
}
