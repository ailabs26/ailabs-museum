import { Exhibit, ExhibitVisibility } from '../entities/exhibit.entity';
import { ExhibitRevision, RevisionState } from '../entities/exhibit-revision.entity';

export interface ExhibitAdminResponse {
  id: string;
  roomId: string;
  status: 'draft' | 'published';
  visibility: ExhibitVisibility;
  version: number;
  displayOrder: number;
  publishedRevisionId: string | null;
  currentRevisionNo: number;
  revisionState: RevisionState;
  content: {
    name: unknown;
    description: unknown;
    position: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number };
    scale?: { x: number; y: number; z: number };
    placeholderShape?: string;
    placeholderColor?: string;
    transcript?: unknown;
    modelId?: string | null;
    imageId?: string | null;
    audioId?: string | null;
  };
  hotspotsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExhibitAdminDetailResponse extends ExhibitAdminResponse {
  room: {
    id: string;
    name: string;
    slug: string;
  } | null;
  hotspots: Array<{
    id: string;
    label: unknown;
    body: unknown;
    position: { x: number; y: number; z: number };
    displayOrder: number;
  }>;
  revisions: Array<{
    id: string;
    revisionNo: number;
    state: RevisionState;
    createdById: string;
    createdBy: { id: string; name: string; email: string } | null;
    reviewedById: string | null;
    reviewedBy: { id: string; name: string; email: string } | null;
    reason: string | null;
    createdAt: Date;
    reviewedAt: Date | null;
  }>;
}

export class ExhibitResponseDto implements ExhibitAdminResponse {
  id!: string;
  roomId!: string;
  status!: 'draft' | 'published';
  visibility!: ExhibitVisibility;
  version!: number;
  displayOrder!: number;
  publishedRevisionId!: string | null;
  currentRevisionNo!: number;
  revisionState!: RevisionState;
  content!: {
    name: unknown;
    description: unknown;
    position: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number };
    scale?: { x: number; y: number; z: number };
    placeholderShape?: string;
    placeholderColor?: string;
    transcript?: unknown;
    modelId?: string | null;
    imageId?: string | null;
    audioId?: string | null;
  };
  hotspotsCount!: number;
  createdAt!: Date;
  updatedAt!: Date;

  static fromEntity(
    entity: Exhibit,
    currentRevision?: ExhibitRevision | null,
  ): ExhibitResponseDto {
    const dto = new ExhibitResponseDto();
    dto.id = entity.id;
    dto.roomId = entity.roomId;
    dto.visibility = entity.visibility;
    dto.version = entity.version;
    dto.displayOrder = entity.displayOrder;
    dto.publishedRevisionId = entity.publishedRevisionId;
    dto.status =
      entity.publishedRevisionId && entity.visibility === ExhibitVisibility.VISIBLE
        ? 'published'
        : 'draft';

    const activeRevision = currentRevision ?? entity.publishedRevision;
    dto.currentRevisionNo = activeRevision ? activeRevision.revisionNo : 0;
    dto.revisionState = activeRevision ? activeRevision.state : RevisionState.DRAFT;

    const rawContent = activeRevision?.content as Record<string, unknown> | undefined;
    dto.content = {
      name: rawContent?.name ?? '',
      description: rawContent?.description ?? '',
      position: (rawContent?.position as { x: number; y: number; z: number }) ?? {
        x: 0,
        y: 0,
        z: 0,
      },
      rotation: (rawContent?.rotation as { x: number; y: number; z: number }) ?? {
        x: 0,
        y: 0,
        z: 0,
      },
      scale: (rawContent?.scale as { x: number; y: number; z: number }) ?? {
        x: 1,
        y: 1,
        z: 1,
      },
      placeholderShape: (rawContent?.placeholderShape as string) ?? 'box',
      placeholderColor: (rawContent?.placeholderColor as string) ?? '#8b7355',
      transcript: rawContent?.transcript ?? null,
      modelId: activeRevision?.modelMediaId ?? null,
      imageId: activeRevision?.imageMediaId ?? null,
      audioId: activeRevision?.audioMediaId ?? null,
    };

    dto.hotspotsCount = activeRevision?.hotspots ? activeRevision.hotspots.length : 0;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;

    return dto;
  }
}

export function toExhibitResponse(
  entity: Exhibit,
  currentRevision?: ExhibitRevision | null,
): ExhibitAdminResponse {
  return ExhibitResponseDto.fromEntity(entity, currentRevision);
}

