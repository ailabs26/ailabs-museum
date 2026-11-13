import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Audit } from '../../audit/decorators/audit.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { UploadFileInterceptor } from '../../../common/interceptors/upload-file.interceptor';
import { AuthUser } from '../../../common/types/auth-user.type';
import { ExportExhibitsQueryDto, ImportExhibitsQueryDto } from '../dto/exhibit-transfer-query.dto';
import { ExhibitTransferService, IMPORT_MAX_BYTES, UploadedTransferFile } from '../services/exhibit-transfer.service';

const IMPORT_UPLOAD = UploadFileInterceptor({
  field: 'file',
  // +1 byte: busboy coi file dài đúng bằng fileSize là vượt (file đúng 2 MB vẫn được nhận).
  limits: { fileSize: IMPORT_MAX_BYTES + 1, files: 1, fields: 5, parts: 6 },
  tooLargeMessage: `File nhập vượt giới hạn ${IMPORT_MAX_BYTES / 1_000_000} MB`,
  codes: { tooLarge: 'exhibit_import_too_large', invalid: 'exhibit_import_invalid_multipart' },
});

/**
 * Task 38 — xuất/nhập hiện vật hàng loạt. Cùng prefix `admin/exhibits` với AdminExhibitsController
 * nên PHẢI được đăng ký trước nó trong ExhibitsModule: nếu không, `GET admin/exhibits/export` bị
 * route `:id` (ParseUUIDPipe) bắt mất và trả 400.
 */
@ApiTags('Admin · Exhibits')
@ApiBearerAuth()
@Controller('admin/exhibits')
export class AdminExhibitTransferController {
  constructor(private readonly transfer: ExhibitTransferService) {}

  @Get('export')
  @Permissions(PERMISSIONS.EXHIBIT_READ)
  @ApiProduces('text/csv', 'application/json')
  @ApiOperation({
    summary: 'Xuất hiện vật (revision mới nhất) ra CSV (UTF-8 có BOM) hoặc JSON, cùng bộ lọc với danh sách; tối đa 5.000',
  })
  async export(@Query() query: ExportExhibitsQueryDto): Promise<StreamableFile> {
    const { format, ...filters } = query;
    const body = await this.transfer.export(filters, format);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
    return new StreamableFile(Buffer.from(body, 'utf8'), {
      type: format === 'json' ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8',
      disposition: `attachment; filename="exhibits-${stamp}.${format}"`,
    });
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.EXHIBIT_CREATE)
  @Audit('exhibit.import', 'exhibit')
  @UseInterceptors(IMPORT_UPLOAD)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({
    summary: 'Nhập hiện vật từ CSV/JSON (≤ 2 MB, ≤ 500 dòng): mỗi dòng hợp lệ tạo một bản nháp mới; trả kết quả theo từng dòng',
  })
  import(
    @UploadedFile() file: UploadedTransferFile | undefined,
    @Query() query: ImportExhibitsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.transfer.import(file, query.dryRun, user);
  }
}
