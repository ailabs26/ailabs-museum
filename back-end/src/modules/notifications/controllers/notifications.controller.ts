import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import type { AuthUser } from '../../../common/types/auth-user.type';
import { NotificationsService } from '../services/notifications.service';

/** Thông báo của chính người đang đăng nhập — không cần quyền riêng, chỉ thao tác trên thông báo của mình. */
@ApiTags('Admin · Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Thông báo của tôi, mới nhất trước (phân trang)' })
  list(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.notifications.list(user.id, query.page, query.pageSize);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Số thông báo chưa đọc (badge chuông)' })
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đánh dấu tất cả đã đọc' })
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Đánh dấu một thông báo đã đọc' })
  @ApiNotFoundResponse({ description: 'Không tồn tại hoặc không phải thông báo của tôi.' })
  async markRead(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<null> {
    await this.notifications.markRead(user.id, id);
    return null;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa một thông báo' })
  @ApiNotFoundResponse({ description: 'Không tồn tại hoặc không phải thông báo của tôi.' })
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<null> {
    await this.notifications.remove(user.id, id);
    return null;
  }
}
