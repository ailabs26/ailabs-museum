import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { AuthUser } from '../../../common/types/auth-user.type';
import { Paginated } from '../../../common/types/paginated.type';
import { User } from '../../users/entities/user.entity';
import {
  ExhibitRevision,
  ExhibitRevisionContent,
  RevisionState,
} from '../../exhibits/entities/exhibit-revision.entity';
import { Exhibit, ExhibitVisibility } from '../../exhibits/entities/exhibit.entity';
import { HideExhibitDto } from '../dto/hide-exhibit.dto';
import { ListQueueQueryDto } from '../dto/list-queue-query.dto';
import { PublishRevisionDto } from '../dto/publish-revision.dto';
import { RejectRevisionDto } from '../dto/reject-revision.dto';
import { DiffFieldDto, RevisionDiffDto } from '../dto/revision-diff.dto';
import {
  ExhibitBriefDto,
  RevisionResponseDto,
  UserBriefDto,
} from '../dto/revision-response.dto';
import { ModerationRepository } from '../repositories/moderation.repository';
import { REVISION_MEDIA_SLOTS } from '../../exhibits/constants/revision-media-slots';
import { resolveBilingual } from '../../exhibits/utils/bilingual';
import { LOCALE_LABELS, SUPPORTED_LOCALES } from '../../translations/constants/locales';
import { RevisionPublishGate } from '../../exhibits/services/revision-publish.gate';
import { NotificationsService } from '../../notifications/services/notifications.service';

/** Field đa ngôn ngữ: diff tách theo từng ngôn ngữ. */
const LOCALIZED_DIFF_FIELDS: { field: string; label: string }[] = [
  { field: 'name', label: 'Tên hiện vật' },
  { field: 'description', label: 'Mô tả' },
  { field: 'transcript', label: 'Thuyết minh' },
  { field: 'altText', label: 'Alt text ảnh' },
];

/** Các field còn lại được so sánh khi diff cũ/mới. */
const DIFF_FIELDS: { field: string; label: string }[] = [
  { field: 'position', label: 'Vị trí (x, y, z)' },
  { field: 'placeholderShape', label: 'Hình khối placeholder' },
  { field: 'placeholderColor', label: 'Màu placeholder' },
];

/** Thông báo xung đột sửa đồng thời (409) cho FE hiện cảnh báo reload. */
const VERSION_CONFLICT =
  'Nội dung đã bị thay đổi bởi người khác, vui lòng tải lại trang';

@Injectable()
export class ModerationService {
  constructor(
    private readonly repo: ModerationRepository,
    private readonly tx: TransactionManager,
    private readonly publishGate: RevisionPublishGate,
    private readonly notifications: NotificationsService,
  ) {}

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

    const fields: DiffFieldDto[] = LOCALIZED_DIFF_FIELDS.flatMap(({ field, label }) =>
      this.diffLocalized(oldContent, newContent, field, label));
    for (const { field, label } of DIFF_FIELDS) {
      const oldValue = this.pickField(oldContent, field);
      const newValue = this.pickField(newContent, field);
      fields.push({ field, label, oldValue, newValue, changed: oldValue !== newValue });
    }
    // Media là cột của revision (không nằm trong content): so sánh theo id media từng slot.
    for (const slot of REVISION_MEDIA_SLOTS) {
      const oldValue = published ? (published[slot.column] ?? null) : null;
      const newValue = revision[slot.column] ?? null;
      fields.push({ field: `media.${slot.key}`, label: slot.label, oldValue, newValue, changed: oldValue !== newValue });
    }

    return {
      revisionId: revision.id,
      exhibitId: revision.exhibitId,
      publishedRevisionNo: published?.revisionNo ?? null,
      targetRevisionNo: revision.revisionNo,
      fields,
    };
  }

  /**
   * Xuất bản revision: in_review → approved, đặt làm bản published của hiện vật,
   * tăng version, hiện hiện vật. Atomic + optimistic lock theo version.
   */
  async publish(
    id: string,
    dto: PublishRevisionDto,
    actor: AuthUser,
  ): Promise<RevisionResponseDto> {
    const revision = await this.repo.findDetail(id);
    if (!revision) throw new NotFoundException('Không tìm thấy phiên bản nội dung');
    if (revision.state !== RevisionState.IN_REVIEW) {
      throw new ConflictException('Phiên bản không ở trạng thái chờ duyệt');
    }

    await this.tx.run(async (m) => {
      // §5.1/5.2: kiểm lại toàn bộ nội dung + media trước khi công khai. Media được khóa
      // FOR SHARE tới hết transaction → không thể bị xóa giữa lúc kiểm tra và lúc publish.
      await this.publishGate.assertPublishable(revision, m);

      const res = await m.update(
        Exhibit,
        { id: revision.exhibitId, version: dto.version },
        {
          publishedRevisionId: revision.id,
          visibility: ExhibitVisibility.VISIBLE,
          archivedAt: null,
          version: () => '"version" + 1',
        },
      );
      if (!res.affected) throw new ConflictException(VERSION_CONFLICT);

      await m.update(
        ExhibitRevision,
        { id: revision.id, state: RevisionState.IN_REVIEW },
        { state: RevisionState.APPROVED, reviewedById: actor.id, reviewedAt: new Date() },
      );
    });

    await this.notifications.revisionReviewed({
      approved: true, exhibitName: revision.content.name, authorId: revision.createdById, reviewerId: actor.id,
    });
    return this.getRevision(id);
  }

  /** Từ chối revision: in_review → rejected, bắt buộc lý do. Optimistic lock. */
  async reject(
    id: string,
    dto: RejectRevisionDto,
    actor: AuthUser,
  ): Promise<RevisionResponseDto> {
    const revision = await this.repo.findDetail(id);
    if (!revision) throw new NotFoundException('Không tìm thấy phiên bản nội dung');
    if (revision.state !== RevisionState.IN_REVIEW) {
      throw new ConflictException('Phiên bản không ở trạng thái chờ duyệt');
    }
    if (!revision.exhibit || revision.exhibit.version !== dto.version) {
      throw new ConflictException(VERSION_CONFLICT);
    }

    const res = await this.tx.run((m) =>
      m.update(
        ExhibitRevision,
        { id: revision.id, state: RevisionState.IN_REVIEW },
        {
          state: RevisionState.REJECTED,
          reason: dto.reason,
          reviewedById: actor.id,
          reviewedAt: new Date(),
        },
      ),
    );
    if (!res.affected) throw new ConflictException(VERSION_CONFLICT);

    await this.notifications.revisionReviewed({
      approved: false, exhibitName: revision.content.name, authorId: revision.createdById, reviewerId: actor.id,
      reason: dto.reason,
    });
    return this.getRevision(id);
  }

  /** Tạm ẩn hiện vật khỏi public. Optimistic lock + tăng version. */
  hide(exhibitId: string, dto: HideExhibitDto): Promise<ExhibitBriefDto> {
    return this.setVisibility(exhibitId, dto.version, ExhibitVisibility.HIDDEN);
  }

  /** Hiện lại hiện vật. Optimistic lock + tăng version. */
  unhide(exhibitId: string, dto: HideExhibitDto): Promise<ExhibitBriefDto> {
    return this.setVisibility(exhibitId, dto.version, ExhibitVisibility.VISIBLE);
  }

  /** Dùng chung cho hide/unhide: cập nhật nguyên tử theo (id, version). */
  private async setVisibility(
    exhibitId: string,
    version: number,
    visibility: ExhibitVisibility,
  ): Promise<ExhibitBriefDto> {
    const exhibit = await this.repo.findExhibit(exhibitId);
    if (!exhibit) throw new NotFoundException('Không tìm thấy hiện vật');

    const res = await this.tx.run((m) =>
      m.update(
        Exhibit,
        { id: exhibitId, version, isDeleted: false },
        {
          visibility,
          archivedAt: visibility === ExhibitVisibility.HIDDEN ? new Date() : null,
          version: () => '"version" + 1',
        },
      ),
    );
    if (!res.affected) throw new ConflictException(VERSION_CONFLICT);

    const updated = await this.repo.findExhibit(exhibitId);
    return this.toExhibitBrief(updated)!;
  }

  /** Một dòng diff cho mỗi ngôn ngữ có nội dung ở bản cũ hoặc bản mới. */
  private diffLocalized(
    oldContent: ExhibitRevisionContent | null,
    newContent: ExhibitRevisionContent | null,
    field: string,
    label: string,
  ): DiffFieldDto[] {
    const read = (content: ExhibitRevisionContent | null) =>
      resolveBilingual((content as unknown as Record<string, unknown> | null)?.[field]);
    const oldText = read(oldContent);
    const newText = read(newContent);
    return SUPPORTED_LOCALES.flatMap((locale) => {
      const oldValue = oldText[locale];
      const newValue = newText[locale];
      if (oldValue === null && newValue === null) return [];
      return [{
        field: `${field}.${locale}`,
        label: `${label} (${LOCALE_LABELS[locale]})`,
        oldValue,
        newValue,
        changed: oldValue !== newValue,
      }];
    });
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
