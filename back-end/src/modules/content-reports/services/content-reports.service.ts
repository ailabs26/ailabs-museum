import {
  ConflictException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../../../common/types/auth-user.type';
import { Paginated } from '../../../common/types/paginated.type';
import { User } from '../../users/entities/user.entity';
import {
  ContentReport,
  ContentReportStatus,
} from '../entities/content-report.entity';
import { CreateReportDto } from '../dto/create-report.dto';
import { ListReportsQueryDto } from '../dto/list-reports-query.dto';
import {
  ReportResponseDto,
  ReportUserBrief,
} from '../dto/report-response.dto';
import { ResolveReportDto } from '../dto/resolve-report.dto';
import { ContentReportsRepository } from '../repositories/content-reports.repository';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { UserBrief, UsersRepository } from '../../users/repositories/users.repository';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';

/** Trạng thái còn mở (chưa đóng) — cho phép chuyển tiếp. */
const OPEN_STATES = [ContentReportStatus.OPEN, ContentReportStatus.IN_PROGRESS];

@Injectable()
export class ContentReportsService {
  constructor(
    private readonly repo: ContentReportsRepository,
    private readonly notifications: NotificationsService,
    private readonly users: UsersRepository,
  ) {}

  /** Danh sách báo cáo cho Admin. */
  async list(query: ListReportsQueryDto): Promise<Paginated<ReportResponseDto>> {
    const result = await this.repo.list(query);
    return { ...result, items: result.items.map((r) => this.toResponse(r)) };
  }

  /** Chi tiết báo cáo. */
  async get(id: string): Promise<ReportResponseDto> {
    return this.toResponse(await this.getOrThrow(id));
  }

  /** Client gửi báo cáo nội dung sai (public). */
  async create(dto: CreateReportDto): Promise<ReportResponseDto> {
    if (!(await this.repo.exhibitExists(dto.exhibitId))) {
      throw new NotFoundException('Không tìm thấy hiện vật cần báo cáo');
    }
    if (dto.reportedRevisionId && !(await this.repo.revisionBelongsToExhibit(dto.reportedRevisionId, dto.exhibitId))) {
      throw new BadRequestException('Phiên bản báo cáo không thuộc hiện vật đã chọn');
    }
    const report = this.repo.create({
      exhibitId: dto.exhibitId,
      reportedRevisionId: dto.reportedRevisionId ?? null,
      category: dto.category,
      message: dto.message,
      status: ContentReportStatus.OPEN,
    });
    const saved = await this.repo.save(report);
    await this.notifications.reportCreated({ exhibitName: await this.repo.exhibitName(dto.exhibitId), message: dto.message });
    return this.toResponse(saved);
  }

  /** Người có thể được giao báo cáo: user active có quyền xử lý báo cáo. */
  assignees(): Promise<UserBrief[]> {
    return this.users.findActiveWithPermission(PERMISSIONS.REPORT_RESOLVE);
  }

  /**
   * Tiếp nhận hoặc giao báo cáo (open/in_progress → in_progress). Bỏ trống `assigneeId` = tự tiếp nhận; giao cho
   * người khác thì người đó phải có quyền xử lý báo cáo và sẽ nhận thông báo. Cho phép giao lại khi đang xử lý.
   */
  async assign(id: string, actor: AuthUser, assigneeId?: string): Promise<ReportResponseDto> {
    const report = await this.getOrThrow(id);
    if (!OPEN_STATES.includes(report.status)) {
      throw new ConflictException('Chỉ có thể giao báo cáo đang mở hoặc đang xử lý');
    }
    const targetId = assigneeId ?? actor.id;
    if (report.status === ContentReportStatus.IN_PROGRESS && report.assignedToId === targetId) {
      throw new ConflictException('Báo cáo đã được giao cho người này');
    }

    let assignee: UserBrief = { id: actor.id, email: actor.email, displayName: actor.displayName };
    if (targetId !== actor.id) {
      const found = (await this.assignees()).find((user) => user.id === targetId);
      if (!found) {
        throw new BadRequestException({
          message: 'Người được giao không tồn tại hoặc không có quyền xử lý báo cáo',
          errors: [{ code: 'invalid_assignee', field: 'assigneeId', message: 'Không có quyền xử lý báo cáo' }],
        });
      }
      assignee = found;
    }

    report.status = ContentReportStatus.IN_PROGRESS;
    report.assignedToId = assignee.id;
    // Gán luôn quan hệ để phản hồi hiện đúng người mới (findDetail đã nạp người cũ hoặc null).
    report.assignedTo = assignee as User;
    const saved = await this.repo.save(report);
    await this.notifications.reportAssigned({
      assigneeId: assignee.id, actorId: actor.id, actorName: actor.displayName,
      exhibitName: await this.repo.exhibitName(report.exhibitId), message: report.message,
    });
    return this.toResponse(saved);
  }

  /** Xử lý xong: → resolved + kết luận. */
  async resolve(id: string, dto: ResolveReportDto, actor: AuthUser): Promise<ReportResponseDto> {
    return this.close(id, ContentReportStatus.RESOLVED, dto.resolution, actor);
  }

  /** Đóng/bác báo cáo: → dismissed + kết luận. */
  async dismiss(id: string, dto: ResolveReportDto, actor: AuthUser): Promise<ReportResponseDto> {
    return this.close(id, ContentReportStatus.DISMISSED, dto.resolution, actor);
  }

  /** Dùng chung cho resolve/dismiss: chỉ cho phép khi báo cáo còn mở. */
  private async close(
    id: string,
    status: ContentReportStatus,
    resolution: string,
    actor: AuthUser,
  ): Promise<ReportResponseDto> {
    const report = await this.getOrThrow(id);
    if (!OPEN_STATES.includes(report.status)) {
      throw new ConflictException('Báo cáo đã được đóng trước đó');
    }
    report.status = status;
    report.resolution = resolution;
    report.resolvedAt = new Date();
    if (!report.assignedToId) report.assignedToId = actor.id;
    return this.toResponse(await this.repo.save(report));
  }

  private async getOrThrow(id: string): Promise<ContentReport> {
    const report = await this.repo.findDetail(id);
    if (!report) throw new NotFoundException('Không tìm thấy báo cáo');
    return report;
  }

  private toUserBrief(user: User | null | undefined): ReportUserBrief | null {
    if (!user) return null;
    return { id: user.id, email: user.email, displayName: user.displayName };
  }

  private toResponse(r: ContentReport): ReportResponseDto {
    return {
      id: r.id,
      exhibitId: r.exhibitId,
      category: r.category,
      message: r.message,
      status: r.status,
      assignedTo: this.toUserBrief(r.assignedTo),
      resolution: r.resolution,
      reportedRevision: r.reportedRevision
        ? {
            id: r.reportedRevision.id,
            revisionNo: r.reportedRevision.revisionNo,
            state: r.reportedRevision.state,
            content: r.reportedRevision.content,
          }
        : null,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    };
  }
}
