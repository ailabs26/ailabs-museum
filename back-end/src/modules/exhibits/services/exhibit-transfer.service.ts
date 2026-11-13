import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ValidationError, validate } from 'class-validator';
import { CSV_BOM, CsvParseError, csvCell, parseCsv, unguardCsvText } from '../../../common/utils/csv.util';
import { RoomsRepository } from '../../rooms/repositories/rooms.repository';
import { CreateExhibitDto } from '../dto/create-exhibit.dto';
import type { ExhibitAdminResponse } from '../dto/exhibit-response.dto';
import { ListExhibitsQueryDto } from '../dto/list-exhibits-query.dto';
import {
  NUMERIC_COLUMNS,
  TRANSFER_COLUMNS,
  TransferRecord,
  exhibitToRecord,
  recordToCreateInput,
  unknownColumns,
} from './exhibit-transfer.columns';
import { ExhibitsService } from './exhibits.service';

/** Giới hạn nhập: đủ cho một đợt số hóa, nhỏ để một request không giữ kết nối DB quá lâu. */
export const IMPORT_MAX_BYTES = 2_000_000;
export const IMPORT_MAX_ROWS = 500;
/** Giới hạn xuất: quá thì yêu cầu lọc theo phòng thay vì dựng file khổng lồ trong RAM. */
export const EXPORT_MAX_ROWS = 5_000;
const EXPORT_PAGE_SIZE = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Cột văn bản có thể bị `csvCell` thêm `'` chống công thức khi xuất → bỏ lại khi nhập. */
const TEXT_COLUMNS = new Set(TRANSFER_COLUMNS.filter((column) => !NUMERIC_COLUMNS.has(column)));

export type TransferFormat = 'csv' | 'json';

export interface ImportFieldError {
  field: string;
  message: string;
}

export interface ImportRowResult {
  /** Số thứ tự dòng dữ liệu, bắt đầu từ 1 (không tính dòng tiêu đề CSV). */
  row: number;
  status: 'valid' | 'created' | 'error';
  /** Tên tiếng Việt (nếu có) để người dùng nhận ra dòng. */
  name: string | null;
  exhibitId: string | null;
  errors: ImportFieldError[];
}

export interface ImportResult {
  dryRun: boolean;
  total: number;
  /** Số dòng hợp lệ (dry run) hoặc đã tạo (nhập thật). */
  valid: number;
  created: number;
  failed: number;
  /** Id hiện vật đã tạo — AuditInterceptor ghi một bản ghi `exhibit.import` cho mỗi id. */
  ids: string[];
  rows: ImportRowResult[];
}

interface ParsedRecord {
  record: TransferRecord;
  /** Lỗi phát hiện ngay khi đọc file (vd thừa ô), gộp vào lỗi của dòng. */
  problems: ImportFieldError[];
}

export interface UploadedTransferFile {
  buffer: Buffer;
  originalname?: string;
}

function fileError(message: string): UnprocessableEntityException {
  return new UnprocessableEntityException({ message, errors: [{ field: 'file', code: 'exhibit_import_invalid_file', message }] });
}

/** Lỗi validate lồng nhau của class-validator → danh sách phẳng `{ field: 'name.vi', message }`. */
function flattenValidationErrors(errors: ValidationError[], parent = ''): ImportFieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => ({ field, message }));
    return [...own, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

@Injectable()
export class ExhibitTransferService {
  private readonly logger = new Logger(ExhibitTransferService.name);

  constructor(
    private readonly exhibits: ExhibitsService,
    private readonly rooms: RoomsRepository,
  ) {}

  // ------------------------------------------------------------------ xuất

  /** Hiện vật (revision mới nhất) khớp bộ lọc của danh sách CMS → nội dung file CSV hoặc JSON. */
  async export(query: Partial<ListExhibitsQueryDto>, format: TransferFormat): Promise<string> {
    const items: ExhibitAdminResponse[] = [];
    for (let page = 1; ; page += 1) {
      const pageQuery = Object.assign(new ListExhibitsQueryDto(), query, { deleted: false, page, pageSize: EXPORT_PAGE_SIZE });
      const result = await this.exhibits.searchAdminExhibits(pageQuery);
      if (result.total > EXPORT_MAX_ROWS) {
        throw new BadRequestException(
          `Có ${result.total.toLocaleString('vi-VN')} hiện vật khớp bộ lọc, vượt giới hạn ${EXPORT_MAX_ROWS.toLocaleString('vi-VN')}. Hãy lọc theo phòng.`,
        );
      }
      items.push(...(result.items as ExhibitAdminResponse[]));
      if (items.length >= result.total || result.items.length === 0) break;
    }

    const slugs = new Map<string, string | null>();
    for (const roomId of new Set(items.map((item) => item.roomId))) {
      slugs.set(roomId, (await this.rooms.findById(roomId))?.slug ?? null);
    }
    const records = items.map((item) => exhibitToRecord(item, slugs.get(item.roomId) ?? null));

    if (format === 'json') {
      return JSON.stringify({ exportedAt: new Date().toISOString(), count: records.length, items: records }, null, 2);
    }
    const lines = [TRANSFER_COLUMNS.map((column) => csvCell(column)).join(',')];
    for (const record of records) {
      lines.push(
        TRANSFER_COLUMNS.map((column) => csvCell(record[column] ?? '', { guardFormula: !NUMERIC_COLUMNS.has(column) })).join(','),
      );
    }
    return `${CSV_BOM}${lines.join('\r\n')}\r\n`;
  }

  // ------------------------------------------------------------------ nhập

  /**
   * Nhập hiện vật từ CSV/JSON. Mỗi dòng hợp lệ tạo một hiện vật Draft MỚI qua `createExhibitDraft`
   * (cùng validate, cùng kiểm tra media, mỗi dòng một transaction). Dòng lỗi không chặn dòng khác:
   * kết quả trả theo từng dòng để giao diện phân biệt thành công một phần.
   * `dryRun` chỉ kiểm tra (DTO + phòng), không ghi gì; media được kiểm tra khi nhập thật.
   */
  async import(file: UploadedTransferFile | undefined, dryRun: boolean, user: { id: string }): Promise<ImportResult> {
    const records = this.parseFile(file);
    const rows: ImportRowResult[] = [];
    const roomCache = new Map<string, string | null>();

    for (const [index, { record, problems }] of records.entries()) {
      const row = index + 1;
      const name = record.name_vi?.trim() || null;
      const parsed = await this.toDto(record, roomCache);
      const errors = [...problems, ...parsed.errors];
      if (errors.length > 0) {
        rows.push({ row, status: 'error', name, exhibitId: null, errors });
        continue;
      }
      if (dryRun) {
        rows.push({ row, status: 'valid', name, exhibitId: null, errors: [] });
        continue;
      }
      try {
        const created = await this.exhibits.createExhibitDraft(parsed.dto, user);
        rows.push({ row, status: 'created', name, exhibitId: created.id, errors: [] });
      } catch (error) {
        rows.push({ row, status: 'error', name, exhibitId: null, errors: [{ field: 'row', message: this.describe(error) }] });
      }
    }

    const ids = rows.flatMap((r) => (r.exhibitId ? [r.exhibitId] : []));
    const failed = rows.filter((r) => r.status === 'error').length;
    return { dryRun, total: rows.length, valid: rows.length - failed, created: ids.length, failed, ids, rows };
  }

  private describe(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      const message = typeof response === 'object' && response && 'message' in response ? (response as { message: unknown }).message : error.message;
      return Array.isArray(message) ? message.join('; ') : String(message);
    }
    this.logger.error(`Nhập hiện vật lỗi không xác định: ${(error as Error)?.stack ?? String(error)}`);
    return 'Lỗi không xác định khi tạo hiện vật, dòng này chưa được nhập';
  }

  /** Dòng → `CreateExhibitDto` đã validate, hoặc danh sách lỗi của dòng. */
  private async toDto(
    record: TransferRecord,
    roomCache: Map<string, string | null>,
  ): Promise<{ dto: CreateExhibitDto; errors: ImportFieldError[] }> {
    const input = recordToCreateInput(record);
    const errors: ImportFieldError[] = [];
    const slug = record.roomSlug?.trim() || null;
    const givenId = typeof input.roomId === 'string' ? input.roomId : null;

    // roomId sai định dạng để DTO báo lỗi; còn lại tra DB (có cache) để dry run thấy phòng không tồn tại.
    const roomBySlug = slug ? await this.lookupRoom(`slug:${slug}`, roomCache, () => this.rooms.findBySlug(slug)) : null;
    const roomById = givenId && UUID.test(givenId)
      ? await this.lookupRoom(`id:${givenId}`, roomCache, () => this.rooms.findById(givenId))
      : null;

    if (slug && !roomBySlug) errors.push({ field: 'roomSlug', message: `Không tìm thấy phòng có slug "${slug}"` });
    if (givenId && UUID.test(givenId) && !roomById) errors.push({ field: 'roomId', message: 'Không tìm thấy phòng có roomId này' });
    if (roomBySlug && roomById && roomBySlug !== roomById) {
      errors.push({ field: 'roomId', message: `roomId không phải phòng có slug "${slug}"` });
    }
    if (!slug && !givenId) errors.push({ field: 'roomSlug', message: 'Cần roomSlug hoặc roomId' });
    if (!givenId && roomBySlug) input.roomId = roomBySlug;

    const dto = plainToInstance(CreateExhibitDto, input);
    const dtoErrors = flattenValidationErrors(await validate(dto, { whitelist: true, forbidNonWhitelisted: true }));
    // Đã báo lỗi phòng ở trên thì bỏ lỗi "roomId không được để trống" trùng ý của DTO.
    const roomReported = errors.length > 0;
    errors.push(...dtoErrors.filter((error) => !(roomReported && error.field === 'roomId')));
    return { dto, errors };
  }

  /** Tra phòng còn hoạt động (chưa xóa mềm) một lần cho mỗi khóa; trả id hoặc null. */
  private async lookupRoom(
    key: string,
    cache: Map<string, string | null>,
    find: () => Promise<{ id: string; isDeleted: boolean } | null>,
  ): Promise<string | null> {
    if (!cache.has(key)) {
      const room = await find();
      cache.set(key, room && !room.isDeleted ? room.id : null);
    }
    return cache.get(key) ?? null;
  }

  /** File → danh sách dòng (khóa = tên cột). Lỗi cấp file (định dạng, cột lạ, quá giới hạn) → 4xx. */
  private parseFile(file: UploadedTransferFile | undefined): ParsedRecord[] {
    if (!file || !Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException({
        message: 'Thiếu file nhập (field "file" trong multipart/form-data)',
        errors: [{ field: 'file', code: 'exhibit_import_file_required', message: 'Thiếu file nhập' }],
      });
    }
    if (file.buffer.length > IMPORT_MAX_BYTES) {
      throw new PayloadTooLargeException(`File nhập vượt giới hạn ${IMPORT_MAX_BYTES / 1_000_000} MB`);
    }
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
    } catch {
      throw fileError('File phải được mã hóa UTF-8');
    }
    if (text.replace(CSV_BOM, '').trim() === '') throw fileError('File rỗng');

    const isJson = /\.json$/i.test(file.originalname ?? '') || /^[[{]/.test(text.replace(CSV_BOM, '').trimStart());
    const records = isJson ? this.parseJson(text) : this.parseCsvRecords(text);
    if (records.length === 0) throw fileError('File không có dòng dữ liệu nào');
    if (records.length > IMPORT_MAX_ROWS) {
      throw fileError(`File có ${records.length} dòng, tối đa ${IMPORT_MAX_ROWS} dòng mỗi lần nhập`);
    }
    return records;
  }

  private parseCsvRecords(text: string): ParsedRecord[] {
    let table: string[][];
    try {
      table = parseCsv(text);
    } catch (error) {
      if (error instanceof CsvParseError) throw fileError(`CSV không hợp lệ: ${error.message}`);
      throw error;
    }
    const [header = [], ...data] = table;
    const columns = header.map((column) => column.trim());
    this.assertColumns(columns);
    return data.map((cells) => {
      const record: TransferRecord = {};
      columns.forEach((column, i) => {
        const value = cells[i] ?? '';
        record[column] = TEXT_COLUMNS.has(column) ? unguardCsvText(value) : value;
      });
      // Thừa ô so với tiêu đề thường do dấu phẩy chưa bọc nháy → dữ liệu đã lệch cột, không nhập dòng này.
      const problems =
        cells.length > columns.length
          ? [{ field: 'row', message: `Dòng có ${cells.length} ô nhưng tiêu đề chỉ có ${columns.length} cột (dấu phẩy trong nội dung cần bọc nháy kép)` }]
          : [];
      return { record, problems };
    });
  }

  private parseJson(text: string): ParsedRecord[] {
    let data: unknown;
    try {
      data = JSON.parse(text.replace(CSV_BOM, ''));
    } catch {
      throw fileError('JSON không hợp lệ');
    }
    const items = Array.isArray(data) ? data : (data as { items?: unknown })?.items;
    if (!Array.isArray(items)) throw fileError('JSON phải là mảng hiện vật hoặc object có trường "items" là mảng');
    const columns = new Set<string>();
    const records = items.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw fileError(`Phần tử thứ ${index + 1} của JSON phải là object`);
      }
      const record: TransferRecord = {};
      for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
        columns.add(key);
        if (value === null || value === undefined) record[key] = '';
        else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') record[key] = String(value);
        else throw fileError(`Phần tử thứ ${index + 1}, trường "${key}": chỉ nhận chuỗi, số hoặc null`);
      }
      return { record, problems: [] };
    });
    this.assertColumns([...columns]);
    return records;
  }

  private assertColumns(columns: string[]): void {
    if (columns.length === 0 || columns.every((column) => column === '')) throw fileError('File thiếu dòng tiêu đề cột');
    const duplicated = columns.filter((column, i) => columns.indexOf(column) !== i);
    if (duplicated.length > 0) throw fileError(`Cột bị lặp: ${[...new Set(duplicated)].join(', ')}`);
    const unknown = unknownColumns(columns);
    if (unknown.length > 0) {
      throw fileError(`Cột không được hỗ trợ: ${unknown.join(', ')}. Xem danh sách cột trong file xuất mẫu.`);
    }
    if (!columns.includes('roomSlug') && !columns.includes('roomId')) {
      throw fileError('File cần cột roomSlug hoặc roomId');
    }
  }
}
