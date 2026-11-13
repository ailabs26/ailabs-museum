import { ExhibitRevisionContent } from '../../exhibits/entities/exhibit-revision.entity';

/** Tóm tắt người dùng (ẩn passwordHash/token). */
export interface UserBriefDto {
  id: string;
  email: string;
  displayName: string;
}

/** Tóm tắt hiện vật đi kèm revision cho màn kiểm duyệt. */
export interface ExhibitBriefDto {
  id: string;
  roomId: string;
  visibility: string;
  version: number;
  publishedRevisionId: string | null;
}

/** Revision trả về cho màn kiểm duyệt (không lộ field nội bộ). */
export interface RevisionResponseDto {
  id: string;
  exhibitId: string;
  revisionNo: number;
  state: string;
  content: ExhibitRevisionContent;
  createdBy: UserBriefDto | null;
  reviewedBy: UserBriefDto | null;
  reason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  exhibit?: ExhibitBriefDto;
}
