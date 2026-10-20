import { ExhibitRevisionContent } from '../../exhibits/entities/exhibit-revision.entity';

export interface ReportUserBrief {
  id: string;
  email: string;
  displayName: string;
}

/** Thông tin phiên bản bị báo cáo (hiển thị cho Admin). */
export interface ReportedRevisionBrief {
  id: string;
  revisionNo: number;
  state: string;
  content: ExhibitRevisionContent;
}

/** Báo cáo vi phạm trả về cho Admin. */
export interface ReportResponseDto {
  id: string;
  exhibitId: string;
  category: string;
  message: string;
  status: string;
  assignedTo: ReportUserBrief | null;
  resolution: string | null;
  reportedRevision: ReportedRevisionBrief | null;
  createdAt: string;
  resolvedAt: string | null;
}
