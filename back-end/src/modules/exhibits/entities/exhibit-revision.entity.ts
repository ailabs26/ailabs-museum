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

  @Column({ name: 'audio_media_id', type: 'uuid', nullable: true })
  audioMediaId!: string | null;

  @ManyToOne(() => Media, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'audio_media_id' })
  audioMedia!: Media | null;

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
