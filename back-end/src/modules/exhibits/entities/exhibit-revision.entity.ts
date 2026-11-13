import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Exhibit } from './exhibit.entity';
import { Hotspot } from './hotspot.entity';
import { Media } from '../../media/entities/media.entity';
import { User } from '../../users/entities/user.entity';

export enum RevisionState {
  DRAFT = 'draft',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface ExhibitRevisionContent {
  name: string;
  description: string;
  position: { x: number; y: number; z: number };
  transcript?: string | null;
  placeholderShape?: string;
  placeholderColor?: string;
}

@Entity('exhibit_revisions')
@Index('UQ_exhibit_revisions_exhibit_no', ['exhibitId', 'revisionNo'], {
  unique: true,
})
// Index một phần cho từng slot media: phục vụ BR-21 (countUsage) và kiểm tra
// "media được revision public hiện hành tham chiếu" khi phân phối file.
@Index('IDX_exhibit_revisions_model_media', ['modelMediaId'], { where: '"model_media_id" IS NOT NULL' })
@Index('IDX_exhibit_revisions_image_media', ['imageMediaId'], { where: '"image_media_id" IS NOT NULL' })
@Index('IDX_exhibit_revisions_audio_media', ['audioMediaId'], { where: '"audio_media_id" IS NOT NULL' })
@Index('IDX_exhibit_revisions_audio_en_media', ['audioEnMediaId'], {
  where: '"audio_en_media_id" IS NOT NULL',
})
@Index('IDX_exhibit_revisions_subtitle_vi_media', ['subtitleViMediaId'], {
  where: '"subtitle_vi_media_id" IS NOT NULL',
})
@Index('IDX_exhibit_revisions_subtitle_en_media', ['subtitleEnMediaId'], {
  where: '"subtitle_en_media_id" IS NOT NULL',
})
@Check('CHK_exhibit_revisions_no', '"revision_no" >= 1')
@Check(
  'CHK_exhibit_revisions_state',
  '"state" IN (\'draft\', \'in_review\', \'approved\', \'rejected\')',
)
export class ExhibitRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'exhibit_id', type: 'uuid' })
  exhibitId!: string;

  @ManyToOne(() => Exhibit, (exhibit) => exhibit.revisions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'exhibit_id' })
  exhibit!: Exhibit;

  @Column({ name: 'revision_no', type: 'integer' })
  revisionNo!: number;

  @Column({ type: 'varchar', length: 16, default: RevisionState.DRAFT })
  state!: RevisionState;

  @Column({ type: 'jsonb' })
  content!: ExhibitRevisionContent;

  @Column({ name: 'model_media_id', type: 'uuid', nullable: true })
  modelMediaId!: string | null;

  @ManyToOne(() => Media, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'model_media_id' })
  modelMedia!: Media | null;

  @Column({ name: 'image_media_id', type: 'uuid', nullable: true })
  imageMediaId!: string | null;

  @ManyToOne(() => Media, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'image_media_id' })
  imageMedia!: Media | null;

  /** Audio guide tiếng Việt (tên cột giữ nguyên từ trước khi có audio đa ngôn ngữ). */
  @Column({ name: 'audio_media_id', type: 'uuid', nullable: true, comment: 'Audio guide tiếng Việt' })
  audioMediaId!: string | null;

  @ManyToOne(() => Media, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'audio_media_id' })
  audioMedia!: Media | null;

  /** Audio guide tiếng Anh. */
  @Column({ name: 'audio_en_media_id', type: 'uuid', nullable: true })
  audioEnMediaId!: string | null;

  @ManyToOne(() => Media, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'audio_en_media_id' })
  audioEnMedia!: Media | null;

  /** Phụ đề WebVTT tiếng Việt, đi kèm audio tiếng Việt. */
  @Column({ name: 'subtitle_vi_media_id', type: 'uuid', nullable: true })
  subtitleViMediaId!: string | null;

  @ManyToOne(() => Media, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'subtitle_vi_media_id' })
  subtitleViMedia!: Media | null;

  /** Phụ đề WebVTT tiếng Anh, đi kèm audio tiếng Anh. */
  @Column({ name: 'subtitle_en_media_id', type: 'uuid', nullable: true })
  subtitleEnMediaId!: string | null;

  @ManyToOne(() => Media, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'subtitle_en_media_id' })
  subtitleEnMedia!: Media | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  createdBy!: User;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedById!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reviewed_by' })
  reviewedBy!: User | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @OneToMany(() => Hotspot, (hotspot) => hotspot.revision)
  hotspots!: Hotspot[];
}
