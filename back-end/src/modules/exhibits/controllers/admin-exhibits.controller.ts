import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit } from '../../audit/decorators/audit.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { BulkIdsDto } from '../../../common/dto/bulk-ids.dto';
import { AuthUser } from '../../../common/types/auth-user.type';
import { CreateExhibitDto } from '../dto/create-exhibit.dto';
import { ListExhibitsQueryDto } from '../dto/list-exhibits-query.dto';
import { ReorderExhibitsDto } from '../dto/reorder-exhibits.dto';
import { UpdateExhibitDto } from '../dto/update-exhibit.dto';
import { ExhibitsService } from '../services/exhibits.service';

@ApiTags('Admin · Exhibits')
@ApiBearerAuth()
@Controller('admin/exhibits')
export class AdminExhibitsController {
  constructor(private readonly exhibitsService: ExhibitsService) {}

  @Get()
  @Permissions(PERMISSIONS.EXHIBIT_READ)
  @ApiOperation({
    summary: 'Danh sách hiện vật (phân trang, lọc theo phòng, trạng thái, tìm kiếm)',
  })
  list(@Query() query: ListExhibitsQueryDto) {
    return this.exhibitsService.searchAdminExhibits(query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.EXHIBIT_READ)
  @ApiOperation({
    summary: 'Chi tiết quản trị một hiện vật theo UUID (kèm phòng, hotspots, lịch sử revisions)',
  })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.exhibitsService.getAdminDetail(id);
  }

  @Get(':id/preview')
  @Permissions(PERMISSIONS.EXHIBIT_READ)
  @ApiOperation({
    summary: 'Xem trước (preview) bản nháp hiện vật kèm 3D transform và hotspots (SRS FR-69)',
  })
  getPreview(@Param('id', ParseUUIDPipe) id: string) {
    return this.exhibitsService.getAdminDetail(id);
  }

  @Get(':id/revisions')
  @Permissions(PERMISSIONS.EXHIBIT_READ)
  @ApiOperation({
    summary: 'Lịch sử các phiên bản revision của một hiện vật',
  })
  getRevisionsHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.exhibitsService.getRevisionsHistory(id);
  }

  @Get(':id/revisions/:revId')
  @Permissions(PERMISSIONS.EXHIBIT_READ)
  @ApiOperation({
    summary: 'Chi tiết một phiên bản revision theo ID',
  })
  getRevisionDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('revId', ParseUUIDPipe) revId: string,
  ) {
    return this.exhibitsService.getRevisionDetail(id, revId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PERMISSIONS.EXHIBIT_CREATE)
  @Audit('exhibit.create', 'exhibit')
  @ApiOperation({
    summary: 'Tạo bản nháp hiện vật mới (Revision #1, trạng thái DRAFT)',
  })
  create(@Body() dto: CreateExhibitDto, @CurrentUser() user: AuthUser) {
    return this.exhibitsService.createExhibitDraft(dto, user);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.EXHIBIT_UPDATE)
  @Audit('exhibit.update', 'exhibit')
  @ApiOperation({
    summary: 'Cập nhật bản nháp hiện vật (SRS BR-21: tự động fork revision mới nếu đã xuất bản)',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExhibitDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.exhibitsService.updateExhibitDraft(id, dto, user);
  }

  @Post(':id/submit-review')
  @Permissions(PERMISSIONS.REVISION_SUBMIT)
  @Audit('revision.submit', 'revision')
  @ApiOperation({
    summary: 'Gửi bản nháp hiện vật đi kiểm duyệt (chuyển sang IN_REVIEW)',
  })
  submitReview(@Param('id', ParseUUIDPipe) id: string) {
    return this.exhibitsService.submitDraftForReview(id);
  }

  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.EXHIBIT_UPDATE)
  @Audit('exhibit.delete', 'exhibit')
  @ApiOperation({
    summary: 'Xóa mềm nhiều hiện vật nháp (tất cả hoặc không; BR-20, 409 kèm lý do từng ID)',
  })
  removeMany(@Body() dto: BulkIdsDto) {
    return this.exhibitsService.removeMany(dto.ids);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.EXHIBIT_UPDATE)
  @Audit('exhibit.delete', 'exhibit')
  @ApiOperation({
    summary: 'Xóa mềm bản nháp hiện vật (SRS BR-20: chặn xóa nếu đã xuất bản/chờ duyệt/có báo cáo; giữ revisions)',
  })
  deleteDraft(@Param('id', ParseUUIDPipe) id: string) {
    return this.exhibitsService.deleteExhibitDraft(id);
  }

  @Delete(':id/revisions/:revId')
  @Permissions(PERMISSIONS.EXHIBIT_UPDATE)
  @Audit('revision.delete', 'revision')
  @ApiOperation({
    summary: 'Xóa một bản revision nháp cụ thể của hiện vật',
  })
  deleteDraftRevision(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('revId', ParseUUIDPipe) revId: string,
  ) {
    return this.exhibitsService.deleteDraftRevision(id, revId);
  }

  @Put('rooms/:roomId/reorder')
  @Permissions(PERMISSIONS.EXHIBIT_UPDATE)
  @Audit('exhibit.reorder', 'exhibit')
  @ApiOperation({
    summary: 'Sắp xếp lại thứ tự hiển thị hiện vật trong phòng',
  })
  reorder(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() body: ReorderExhibitsDto,
  ) {
    return this.exhibitsService.reorderExhibits(roomId, body.exhibitIds);
  }
}
