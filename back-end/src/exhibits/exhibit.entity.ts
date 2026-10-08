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
  UpdateDateColumn,
} from 'typeorm';
import { ContentReport } from '../content-reports/content-report.entity';
import { ExhibitRevision } from '../exhibit-revisions/exhibit-revision.entity';
import { Room } from '../rooms/room.entity';

export enum ExhibitVisibility {
  VISIBLE = 'visible',
  HIDDEN = 'hidden',
}

@Entity('exhibits')
@Index('IDX_exhibits_room_order_id', ['roomId', 'displayOrder', 'id'])
@Check('CHK_exhibits_visibility', '"visibility" IN (\'visible\', \'hidden\')')
@Check('CHK_exhibits_version', '"version" >= 0')
@Check('CHK_exhibits_display_order', '"display_order" >= 0')
@Check('CHK_exhibits_deleted', '"is_deleted" = ("deleted_at" IS NOT NULL)')
export class Exhibit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'room_id', type: 'uuid' })
  roomId!: string;

  @ManyToOne(() => Room, (room) => room.exhibits, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'room_id' })
  room!: Room;

  @Column({ name: 'published_revision_id', type: 'uuid', nullable: true })
  publishedRevisionId!: string | null;

  @ManyToOne(() => ExhibitRevision, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'published_revision_id' })
  publishedRevision!: ExhibitRevision | null;

  @Column({ type: 'varchar', length: 12, default: ExhibitVisibility.HIDDEN })
  visibility!: ExhibitVisibility;

  @Column({ type: 'integer', default: 0 })
  version!: number;

  @Column({ name: 'display_order', type: 'integer', default: 0 })
  displayOrder!: number;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted!: boolean;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => ExhibitRevision, (revision) => revision.exhibit)
  revisions!: ExhibitRevision[];

  @OneToMany(() => ContentReport, (report) => report.exhibit)
  reports!: ContentReport[];
}
