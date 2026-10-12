import {
  ConflictException,
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

/** Trạng thái còn mở (chưa đóng) — cho phép chuyển tiếp. */
const OPEN_STATES = [ContentReportStatus.OPEN, ContentReportStatus.IN_PROGRESS];

@Injectable()
export class ContentReportsService {
  constructor(private readonly repo: ContentReportsRepository) {}

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
    const report = this.repo.create({
      exhibitId: dto.exhibitId,
      reportedRevisionId: dto.reportedRevisionId ?? null,
      category: dto.category,
      message: dto.message,
      status: ContentReportStatus.OPEN,
    });
    return this.toResponse(await this.repo.save(report));
  }

  /** Tiếp nhận báo cáo: open → in_progress, gán cho người xử lý. */
  async assign(id: string, actor: AuthUser): Promise<ReportResponseDto> {
    const report = await this.getOrThrow(id);
    if (report.status !== ContentReportStatus.OPEN) {
      throw new ConflictException('Chỉ có thể tiếp nhận báo cáo đang mở');
    }
    report.status = ContentReportStatus.IN_PROGRESS;
    report.assignedToId = actor.id;
    return this.toResponse(await this.repo.save(report));
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
