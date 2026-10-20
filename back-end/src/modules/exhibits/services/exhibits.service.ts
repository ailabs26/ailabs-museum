import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TransactionManager } from '../../../common/database/transaction.manager';
import { Paginated } from '../../../common/types/paginated.type';
import { RoomStatus } from '../../rooms/entities/room.entity';
import { RoomsRepository } from '../../rooms/repositories/rooms.repository';
import { CreateExhibitDto } from '../dto/create-exhibit.dto';
import { ListExhibitsQueryDto } from '../dto/list-exhibits-query.dto';
import {
  ExhibitAdminDetailResponse,
  ExhibitAdminResponse,
  toExhibitResponse,
} from '../dto/exhibit-response.dto';
import { UpdateExhibitDto } from '../dto/update-exhibit.dto';
import { Exhibit, ExhibitVisibility } from '../entities/exhibit.entity';
import {
  ExhibitRevision,
  ExhibitRevisionContent,
  RevisionState,
} from '../entities/exhibit-revision.entity';
import { Hotspot } from '../entities/hotspot.entity';
import { toPublicModel } from '../../media/dto/public-model.dto';
import { ExhibitsRepository } from '../repositories/exhibits.repository';

@Injectable()
export class ExhibitsService {
  constructor(
    private readonly exhibits: ExhibitsRepository,
    private readonly roomsRepo: RoomsRepository,
    private readonly tx: TransactionManager,
  ) {}

  // =========================================================================
  // 1. PUBLIC VISITOR METHODS (Không đổi định dạng để bảo vệ 3D Canvas)
  // =========================================================================

  /**
   * Danh sách phòng trưng bày công khai đang hoạt động (active).
   */
  async roomsList() {
    const rooms = await this.roomsRepo.findPublicRooms();
    return rooms.map(({ id, slug, name, description }) => ({ id, slug, name, description }));
  }

  /**
   * Chi tiết phòng kèm danh sách hiện vật đã xuất bản (cho khách tham quan).
   */
  async roomWithExhibits(slug: string) {
    const room = await this.roomsRepo.findBySlug(slug);

    if (!room || room.status !== RoomStatus.ACTIVE || room.isDeleted) {
      throw new NotFoundException('Không tìm thấy phòng trưng bày');
    }

    const exhibits = (await this.exhibits.findByRoom(room.id)).flatMap(
      (exhibit) => {
        const revision = exhibit.publishedRevision;

        if (!revision || revision.state !== RevisionState.APPROVED) {
          return [];
        }

        const content = revision.content as unknown as Record<string, unknown> | undefined;
        const candidate = content?.position as { x?: unknown; y?: unknown; z?: unknown } | undefined;
        const position = candidate && [candidate.x, candidate.y, candidate.z].every(value => typeof value === 'number' && Number.isFinite(value))
          ? candidate as { x: number; y: number; z: number } : undefined;

        return [
          {
            id: exhibit.id,
            roomId: exhibit.roomId,
            displayOrder: exhibit.displayOrder,
            name: content?.name,
            description: content?.description,
            positionX: position?.x,
            positionY: position?.y,
            positionZ: position?.z,
            transcript: content?.transcript ?? null,
            placeholderShape: content?.placeholderShape ?? 'box',
            placeholderColor: content?.placeholderColor ?? '#8b7355',
            hotspots: (revision.hotspots || [])
              .map((hotspot) => ({
                id: hotspot.id,
                label: hotspot.label,
                body: hotspot.body,
                positionX: Number(hotspot.positionX),
                positionY: Number(hotspot.positionY),
                positionZ: Number(hotspot.positionZ),
                displayOrder: hotspot.displayOrder,
              }))
              .sort((left, right) => left.displayOrder - right.displayOrder),
            model: toPublicModel(revision.modelMedia, room.slug, exhibit.id),
            image: null,
            audio: null,
          },
        ];
      },
    );

    return {
      id: room.id,
      slug: room.slug,
      name: room.name,
      description: room.description,
      exhibits,
    };
  }

  // =========================================================================
  // 2. ADMIN CMS QUERY METHODS (Tìm kiếm & Chi tiết hiện vật)
  // =========================================================================

  /**
   * Tìm kiếm, phân trang và lọc danh sách hiện vật cho quản trị viên.
   */
  async searchAdminExhibits(
    query: ListExhibitsQueryDto,
  ): Promise<Paginated<ExhibitAdminResponse>> {
    const result = await this.exhibits.searchAdminExhibits(query);
    return {
      ...result,
      items: result.items.map((item) => toExhibitResponse(item)),
    };
  }

  /**
   * Lấy chi tiết quản trị một hiện vật kèm thông tin phòng, phiên bản và hotspots.
   */
  async getAdminDetail(id: string): Promise<ExhibitAdminDetailResponse> {
    const exhibit = await this.exhibits.findAdminDetailById(id);
    if (!exhibit || exhibit.isDeleted) {
      throw new NotFoundException('Không tìm thấy hiện vật');
    }

    const activeRevision =
      exhibit.revisions && exhibit.revisions.length > 0
        ? [...exhibit.revisions].sort((a, b) => b.revisionNo - a.revisionNo)[0]
        : exhibit.publishedRevision;

    const baseResponse = toExhibitResponse(exhibit, activeRevision);

    return {
      ...baseResponse,
      room: exhibit.room
        ? {
            id: exhibit.room.id,
            name: exhibit.room.name,
            slug: exhibit.room.slug,
          }
        : null,
      hotspots: (activeRevision?.hotspots ?? []).map((h) => ({
        id: h.id,
        label: h.label,
        body: h.body,
        position: {
          x: Number(h.positionX),
          y: Number(h.positionY),
          z: Number(h.positionZ),
        },
        displayOrder: h.displayOrder,
      })),
      revisions: (exhibit.revisions ?? []).map((rev) => ({
        id: rev.id,
        revisionNo: rev.revisionNo,
        state: rev.state,
        createdById: rev.createdById,
        createdBy: rev.createdBy
          ? {
              id: rev.createdBy.id,
              name: rev.createdBy.displayName,
              email: rev.createdBy.email,
            }
          : null,
        reviewedById: rev.reviewedById,
        reviewedBy: rev.reviewedBy
          ? {
              id: rev.reviewedBy.id,
              name: rev.reviewedBy.displayName,
              email: rev.reviewedBy.email,
            }
          : null,
        reason: rev.reason,
        createdAt: rev.createdAt,
        reviewedAt: rev.reviewedAt,
      })),
    };
  }

  // =========================================================================
  // 3. ADMIN CRUD DRAFT (Tạo & Cập nhật bản nháp hiện vật)
  // =========================================================================

  /**
   * Tạo bản ghi hiện vật mới ở trạng thái Draft kèm revision đầu tiên (#1) trong 1 transaction.
   */
  async createExhibitDraft(
    dto: CreateExhibitDto,
    user: { id: string },
  ): Promise<ExhibitAdminResponse> {
    const room = await this.roomsRepo.findById(dto.roomId);
    if (!room || room.isDeleted) {
      throw new NotFoundException('Không tìm thấy phòng trưng bày');
    }

    let displayOrder = dto.displayOrder;
    if (displayOrder === undefined || displayOrder === null) {
      const count = await this.exhibits.countByRoom(dto.roomId);
      displayOrder = count + 1;
    }

    return this.tx.run(async (manager) => {
      // 1. Tạo bản ghi Exhibit
      const exhibitEntity = this.exhibits.create({
        roomId: dto.roomId,
        displayOrder,
        visibility: ExhibitVisibility.HIDDEN,
        publishedRevisionId: null,
        version: 1,
        isDeleted: false,
      });
      const exhibit = (await this.exhibits.save(exhibitEntity, manager)) as Exhibit;

      // 2. Chuẩn bị nội dung content JSONB
      const content = this.buildContentFromCreateDto(dto);

      // 3. Lưu ExhibitRevision (#1, state: DRAFT)
      const revision = await this.exhibits.saveRevision(
        {
          exhibitId: exhibit.id,
          revisionNo: 1,
          state: RevisionState.DRAFT,
          content,
          modelMediaId: dto.modelId ?? null,
          imageMediaId: dto.imageId ?? null,
          audioMediaId: dto.audioId ?? null,
          createdById: user.id,
          reviewedById: null,
          reason: null,
        } as ExhibitRevision,
        manager,
      );

      // 4. Lưu Hotspots nếu có
      if (dto.hotspots && dto.hotspots.length > 0) {
        const hotspots = dto.hotspots.map((h, i) => ({
          revisionId: revision.id,
          label: h.label,
          body: h.body,
          positionX: String(h.positionX ?? 0),
          positionY: String(h.positionY ?? 0),
          positionZ: String(h.positionZ ?? 0),
          displayOrder: h.displayOrder ?? i + 1,
        }));
        revision.hotspots = await this.exhibits.saveHotspots(
          hotspots as Hotspot[],
          manager,
        );
      } else {
        revision.hotspots = [];
      }

      return toExhibitResponse(exhibit, revision);
    });
  }

  /**
   * Cập nhật bản nháp hiện vật (SRS 5.1 & BR-21):
   * - Nếu revision hiện tại đang IN_REVIEW: chặn sửa trực tiếp (BR-26).
   * - Nếu revision hiện tại đang APPROVED (published): fork ra revision mới (BR-21 immutability).
   * - Nếu revision hiện tại đang DRAFT/REJECTED: cập nhật tại chỗ (nếu REJECTED thì chuyển về DRAFT).
   */
  async updateExhibitDraft(
    id: string,
    dto: UpdateExhibitDto,
    user: { id: string },
  ): Promise<ExhibitAdminResponse> {
    const exhibit = await this.exhibits.findAdminDetailById(id);
    if (!exhibit || exhibit.isDeleted) {
      throw new NotFoundException('Không tìm thấy hiện vật');
    }

    if (dto.roomId && dto.roomId !== exhibit.roomId) {
      const room = await this.roomsRepo.findById(dto.roomId);
      if (!room || room.isDeleted) {
        throw new NotFoundException('Không tìm thấy phòng trưng bày');
      }
    }

    const activeRev = await this.exhibits.findActiveRevision(id);
    if (!activeRev) {
      throw new NotFoundException('Không tìm thấy phiên bản hiện vật');
    }

    // BR-26: In Review không được sửa trực tiếp
    if (activeRev.state === RevisionState.IN_REVIEW) {
      throw new ConflictException(
        'Hiện vật đang trong quá trình kiểm duyệt, không thể chỉnh sửa trực tiếp',
      );
    }

    return this.tx.run(async (manager) => {
      // 1. Cập nhật thông tin Exhibit nếu có thay đổi
      exhibit.version = (exhibit.version ?? 0) + 1;
      if (dto.roomId) exhibit.roomId = dto.roomId;
      if (dto.displayOrder !== undefined && dto.displayOrder !== null) {
        exhibit.displayOrder = dto.displayOrder;
      }
      await this.exhibits.save(exhibit, manager);

      const mergedContent = this.mergeContentWithUpdateDto(
        activeRev.content as unknown as Record<string, unknown>,
        dto,
      );

      // BR-21: Nếu revision hiện tại đã APPROVED, fork ra bản revision mới
      if (activeRev.state === RevisionState.APPROVED) {
        const nextRevisionNo =
          (await this.exhibits.findLatestRevisionNo(id, manager)) + 1;

        const newRevision = await this.exhibits.saveRevision(
          {
            exhibitId: exhibit.id,
            revisionNo: nextRevisionNo,
            state: RevisionState.DRAFT,
            content: mergedContent,
            modelMediaId:
              dto.modelId !== undefined ? dto.modelId : activeRev.modelMediaId,
            imageMediaId:
              dto.imageId !== undefined ? dto.imageId : activeRev.imageMediaId,
            audioMediaId:
              dto.audioId !== undefined ? dto.audioId : activeRev.audioMediaId,
            createdById: user.id,
            reviewedById: null,
            reason: null,
          } as ExhibitRevision,
          manager,
        );

        // Lưu hotspots cho revision mới (sử dụng dto hoặc sao chép từ revision cũ)
        const hotspotsToUse =
          dto.hotspots !== undefined
            ? dto.hotspots
            : (activeRev.hotspots ?? []).map((h) => ({
                label: h.label,
                body: h.body,
                positionX: Number(h.positionX),
                positionY: Number(h.positionY),
                positionZ: Number(h.positionZ),
                displayOrder: h.displayOrder,
              }));

        if (hotspotsToUse.length > 0) {
          newRevision.hotspots = await this.exhibits.saveHotspots(
            hotspotsToUse.map((h, i) => ({
              revisionId: newRevision.id,
              label: (h as Record<string, unknown>).label,
              body: (h as Record<string, unknown>).body,
              positionX: String(h.positionX ?? 0),
              positionY: String(h.positionY ?? 0),
              positionZ: String(h.positionZ ?? 0),
              displayOrder: h.displayOrder ?? i + 1,
            })) as Hotspot[],
            manager,
          );
        } else {
          newRevision.hotspots = [];
        }

        return toExhibitResponse(exhibit, newRevision);
      }

      // Ngược lại (DRAFT hoặc REJECTED): Chỉnh sửa bản nháp hiện tại
      activeRev.state = RevisionState.DRAFT;
      activeRev.content = mergedContent;
      if (dto.modelId !== undefined) activeRev.modelMediaId = dto.modelId;
      if (dto.imageId !== undefined) activeRev.imageMediaId = dto.imageId;
      if (dto.audioId !== undefined) activeRev.audioMediaId = dto.audioId;

      if (dto.hotspots !== undefined) {
        await this.exhibits.deleteHotspotsByRevisionIds([activeRev.id], manager);
        if (dto.hotspots.length > 0) {
          activeRev.hotspots = await this.exhibits.saveHotspots(
            dto.hotspots.map((h, i) => ({
              revisionId: activeRev.id,
              label: h.label,
              body: h.body,
              positionX: String(h.positionX ?? 0),
              positionY: String(h.positionY ?? 0),
              positionZ: String(h.positionZ ?? 0),
              displayOrder: h.displayOrder ?? i + 1,
            })) as Hotspot[],
            manager,
          );
        } else {
          activeRev.hotspots = [];
        }
      }

      const savedRev = await this.exhibits.saveRevision(activeRev, manager);
      return toExhibitResponse(exhibit, savedRev);
    });
  }

  // =========================================================================
  // 4. SUBMIT REVIEW & REVISION WORKFLOW
  // =========================================================================

  /**
   * Gửi bản nháp hiện vật đi kiểm duyệt (DRAFT/REJECTED -> IN_REVIEW).
   */
  async submitDraftForReview(id: string): Promise<ExhibitAdminResponse> {
    const exhibit = await this.exhibits.findAdminDetailById(id);
    if (!exhibit || exhibit.isDeleted) {
      throw new NotFoundException('Không tìm thấy hiện vật');
    }

    const activeRev = await this.exhibits.findActiveRevision(id);
    if (!activeRev) {
      throw new NotFoundException('Không tìm thấy phiên bản hiện vật');
    }

    if (activeRev.state === RevisionState.IN_REVIEW) {
      throw new ConflictException(
        'Phiên bản hiện vật đã được gửi kiểm duyệt trước đó',
      );
    }

    if (activeRev.state === RevisionState.APPROVED) {
      throw new ConflictException('Không có bản nháp nào để gửi kiểm duyệt');
    }

    return this.tx.run(async (manager) => {
      activeRev.state = RevisionState.IN_REVIEW;
      await this.exhibits.saveRevision(activeRev, manager);

      exhibit.version = (exhibit.version ?? 0) + 1;
      await this.exhibits.save(exhibit, manager);

      return toExhibitResponse(exhibit, activeRev);
    });
  }

  // =========================================================================
  // 5. DELETE DRAFT & CASCADE DELETION (BR-20)
  // =========================================================================

  /**
   * Xóa bản nháp hiện vật (BR-20):
   * Chặn xóa nếu hiện vật đã xuất bản (ném ConflictException).
   * Xóa cascade an toàn (hotspots -> revisions -> exhibit) trong transaction khi chỉ có draft.
   */
  async deleteExhibitDraft(
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    const exhibit = await this.exhibits.findAdminDetailById(id);
    if (!exhibit || exhibit.isDeleted) {
      throw new NotFoundException('Không tìm thấy hiện vật');
    }

    // BR-20: Bảo vệ hiện vật đã xuất bản
    if (
      exhibit.publishedRevisionId !== null ||
      exhibit.visibility === ExhibitVisibility.VISIBLE
    ) {
      throw new ConflictException(
        'Không thể xóa hiện vật đã xuất bản. Vui lòng ẩn (Hide/Unpublish) hiện vật trước',
      );
    }

    await this.tx.run(async (manager) => {
      await this.exhibits.deleteCascadeDraft(id, manager);
    });

    return {
      success: true,
      message: 'Đã xóa bản nháp hiện vật thành công',
    };
  }

  /**
   * Xóa một revision nháp cụ thể (khi exhibit đã có bản xuất bản khác).
   */
  async deleteDraftRevision(
    exhibitId: string,
    revisionId: string,
  ): Promise<{ success: boolean; message: string }> {
    const exhibit = await this.exhibits.findAdminDetailById(exhibitId);
    if (!exhibit || exhibit.isDeleted) {
      throw new NotFoundException('Không tìm thấy hiện vật');
    }

    const revision = await this.exhibits.findRevisionById(revisionId);
    if (!revision || revision.exhibitId !== exhibitId) {
      throw new NotFoundException('Không tìm thấy phiên bản hiện vật');
    }

    // BR-20 & BR-21: Không được xóa revision đang xuất bản hoặc đã approved / in_review
    if (revision.id === exhibit.publishedRevisionId) {
      throw new ConflictException('Không thể xóa phiên bản đang được xuất bản');
    }

    if (revision.state === RevisionState.APPROVED) {
      throw new ConflictException('Không thể xóa phiên bản đã được phê duyệt');
    }

    if (revision.state === RevisionState.IN_REVIEW) {
      throw new ConflictException('Không thể xóa phiên bản đang chờ kiểm duyệt');
    }

    await this.tx.run(async (manager) => {
      await this.exhibits.deleteHotspotsByRevisionIds([revisionId], manager);
      await this.exhibits.deleteRevisionById(revisionId, manager);
    });

    return {
      success: true,
      message: 'Đã xóa phiên bản nháp thành công',
    };
  }

  // =========================================================================
  // 6. REORDER & REVISION HISTORY
  // =========================================================================

  /**
   * Sắp xếp lại thứ tự hiện vật trong một phòng trưng bày.
   */
  async reorderExhibits(
    roomId: string,
    exhibitIds: string[],
  ): Promise<{ success: boolean; message: string }> {
    const room = await this.roomsRepo.findById(roomId);
    if (!room || room.isDeleted) {
      throw new NotFoundException('Không tìm thấy phòng trưng bày');
    }

    await this.tx.run(async (manager) => {
      for (let i = 0; i < exhibitIds.length; i++) {
        const id = exhibitIds[i];
        await this.exhibits.updateDisplayOrder(id, i + 1, manager);
      }
    });

    return {
      success: true,
      message: 'Đã cập nhật thứ tự hiện vật thành công',
    };
  }

  /**
   * Lấy lịch sử các phiên bản của một hiện vật.
   */
  async getRevisionsHistory(exhibitId: string): Promise<ExhibitRevision[]> {
    const exhibit = await this.exhibits.findAdminDetailById(exhibitId);
    if (!exhibit || exhibit.isDeleted) {
      throw new NotFoundException('Không tìm thấy hiện vật');
    }
    return this.exhibits.findRevisionsByExhibitId(exhibitId);
  }

  /**
   * Lấy chi tiết một phiên bản theo ID.
   */
  async getRevisionDetail(
    exhibitId: string,
    revisionId: string,
  ): Promise<ExhibitRevision> {
    const revision = await this.exhibits.findRevisionById(revisionId);
    if (!revision || revision.exhibitId !== exhibitId) {
      throw new NotFoundException('Không tìm thấy phiên bản hiện vật');
    }
    return revision;
  }

  // =========================================================================
  // 7. PRIVATE HELPER METHODS
  // =========================================================================

  private buildContentFromCreateDto(
    dto: CreateExhibitDto,
  ): ExhibitRevisionContent {
    return {
      name: (dto.name ? (typeof dto.name === 'string' ? dto.name : dto.name) : { vi: '', en: '' }) as unknown as string,
      description: (dto.description ? (typeof dto.description === 'string' ? dto.description : dto.description) : { vi: '', en: '' }) as unknown as string,
      position: dto.getResolvedPosition ? dto.getResolvedPosition() : {
        x: dto.position?.x ?? dto.positionX ?? 0,
        y: dto.position?.y ?? dto.positionY ?? 0,
        z: dto.position?.z ?? dto.positionZ ?? 0,
      },
      rotation: dto.getResolvedRotation ? dto.getResolvedRotation() : {
        x: dto.rotation?.x ?? dto.rotationX ?? 0,
        y: dto.rotation?.y ?? dto.rotationY ?? 0,
        z: dto.rotation?.z ?? dto.rotationZ ?? 0,
      },
      scale: dto.getResolvedScale ? dto.getResolvedScale() : {
        x: dto.scale?.x ?? dto.scaleX ?? 1,
        y: dto.scale?.y ?? dto.scaleY ?? 1,
        z: dto.scale?.z ?? dto.scaleZ ?? 1,
      },
      placeholderShape: dto.placeholderShape ?? 'box',
      placeholderColor: dto.placeholderColor ?? '#8b7355',
      transcript: (dto.transcript ?? dto.transcriptPlain ?? null) as unknown as string | null,
      altText: dto.altText ?? dto.altTextPlain ?? null,
    } as unknown as ExhibitRevisionContent;
  }

  private mergeContentWithUpdateDto(
    prev: Record<string, unknown> = {},
    dto: UpdateExhibitDto,
  ): ExhibitRevisionContent {
    const prevPos = (prev.position as { x: number; y: number; z: number }) ?? {
      x: 0,
      y: 0,
      z: 0,
    };
    const prevRot = (prev.rotation as { x: number; y: number; z: number }) ?? {
      x: 0,
      y: 0,
      z: 0,
    };
    const prevScale = (prev.scale as { x: number; y: number; z: number }) ?? {
      x: 1,
      y: 1,
      z: 1,
    };

    return {
      name: (dto.name !== undefined ? dto.name : prev.name) as unknown as string,
      description: (dto.description !== undefined ? dto.description : prev.description) as unknown as string,
      position: {
        x: dto.position?.x ?? dto.positionX ?? prevPos.x ?? 0,
        y: dto.position?.y ?? dto.positionY ?? prevPos.y ?? 0,
        z: dto.position?.z ?? dto.positionZ ?? prevPos.z ?? 0,
      },
      rotation: {
        x: dto.rotation?.x ?? dto.rotationX ?? prevRot.x ?? 0,
        y: dto.rotation?.y ?? dto.rotationY ?? prevRot.y ?? 0,
        z: dto.rotation?.z ?? dto.rotationZ ?? prevRot.z ?? 0,
      },
      scale: {
        x: dto.scale?.x ?? dto.scaleX ?? prevScale.x ?? 1,
        y: dto.scale?.y ?? dto.scaleY ?? prevScale.y ?? 1,
        z: dto.scale?.z ?? dto.scaleZ ?? prevScale.z ?? 1,
      },
      placeholderShape: (dto.placeholderShape ?? prev.placeholderShape ?? 'box') as string,
      placeholderColor: (dto.placeholderColor ?? prev.placeholderColor ?? '#8b7355') as string,
      transcript: (dto.transcript !== undefined
        ? dto.transcript
        : dto.transcriptPlain !== undefined
        ? dto.transcriptPlain
        : prev.transcript ?? null) as unknown as string | null,
      altText: (dto.altText !== undefined
        ? dto.altText
        : dto.altTextPlain !== undefined
        ? dto.altTextPlain
        : prev.altText ?? null) as unknown,
    } as unknown as ExhibitRevisionContent;
  }
}
