import { Injectable, NotFoundException } from '@nestjs/common';
import { Paginated } from '../../../common/types/paginated.type';
import { User } from '../../users/entities/user.entity';
import {
  ExhibitRevision,
  ExhibitRevisionContent,
} from '../../exhibits/entities/exhibit-revision.entity';
import { Exhibit } from '../../exhibits/entities/exhibit.entity';
import { ListQueueQueryDto } from '../dto/list-queue-query.dto';
import { DiffFieldDto, RevisionDiffDto } from '../dto/revision-diff.dto';
import {
  ExhibitBriefDto,
  RevisionResponseDto,
  UserBriefDto,
} from '../dto/revision-response.dto';
import { ModerationRepository } from '../repositories/moderation.repository';

/** Các field nội dung được so sánh khi diff cũ/mới. */
const DIFF_FIELDS: { field: string; label: string }[] = [
  { field: 'name', label: 'Tên hiện vật' },
  { field: 'description', label: 'Mô tả' },
  { field: 'transcript', label: 'Thuyết minh' },
  { field: 'position', label: 'Vị trí (x, y, z)' },
  { field: 'placeholderShape', label: 'Hình khối placeholder' },
  { field: 'placeholderColor', label: 'Màu placeholder' },
];

@Injectable()
export class ModerationService {
  constructor(private readonly repo: ModerationRepository) {}

  /** Hàng chờ kiểm duyệt (revision in_review). */
  async queue(query: ListQueueQueryDto): Promise<Paginated<RevisionResponseDto>> {
    const result = await this.repo.queue(query);
    return { ...result, items: result.items.map((r) => this.toResponse(r)) };
  }

  /** Chi tiết 1 revision. */
  async getRevision(id: string): Promise<RevisionResponseDto> {
    const revision = await this.repo.findDetail(id);
    if (!revision) throw new NotFoundException('Không tìm thấy phiên bản nội dung');
    return this.toResponse(revision);
  }

  /** Lịch sử revision của 1 hiện vật. */
  async history(exhibitId: string): Promise<RevisionResponseDto[]> {
    const items = await this.repo.findHistory(exhibitId);
    return items.map((r) => this.toResponse(r));
  }

  /** So sánh revision đang xét với bản đang xuất bản (field-by-field). */
  async diff(id: string): Promise<RevisionDiffDto> {
    const revision = await this.repo.findForDiff(id);
    if (!revision) throw new NotFoundException('Không tìm thấy phiên bản nội dung');

    const published = revision.exhibit?.publishedRevision ?? null;
    const oldContent = published?.content ?? null;
    const newContent = revision.content;

    const fields: DiffFieldDto[] = DIFF_FIELDS.map(({ field, label }) => {
      const oldValue = this.pickField(oldContent, field);
      const newValue = this.pickField(newContent, field);
      return { field, label, oldValue, newValue, changed: oldValue !== newValue };
    });

    return {
      revisionId: revision.id,
      exhibitId: revision.exhibitId,
      publishedRevisionNo: published?.revisionNo ?? null,
      targetRevisionNo: revision.revisionNo,
      fields,
    };
  }

  /** Lấy giá trị 1 field dưới dạng chuỗi để so sánh/hiển thị. */
  private pickField(content: ExhibitRevisionContent | null, field: string): string | null {
    if (!content) return null;
    if (field === 'position') {
      const p = content.position;
      return p ? `${p.x}, ${p.y}, ${p.z}` : null;
    }
    const value = (content as unknown as Record<string, unknown>)[field];
    return value === undefined || value === null ? null : String(value);
  }

  private toUserBrief(user: User | null | undefined): UserBriefDto | null {
    if (!user) return null;
    return { id: user.id, email: user.email, displayName: user.displayName };
  }

  private toExhibitBrief(exhibit: Exhibit | null | undefined): ExhibitBriefDto | undefined {
    if (!exhibit) return undefined;
    return {
      id: exhibit.id,
      roomId: exhibit.roomId,
      visibility: exhibit.visibility,
      version: exhibit.version,
      publishedRevisionId: exhibit.publishedRevisionId,
    };
  }

  private toResponse(r: ExhibitRevision): RevisionResponseDto {
    return {
      id: r.id,
      exhibitId: r.exhibitId,
      revisionNo: r.revisionNo,
      state: r.state,
      content: r.content,
      createdBy: this.toUserBrief(r.createdBy),
      reviewedBy: this.toUserBrief(r.reviewedBy),
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      exhibit: this.toExhibitBrief(r.exhibit),
    };
  }
}
