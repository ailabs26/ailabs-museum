import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ExhibitRevision } from './exhibit-revision.entity';

@Entity('hotspots')
@Check('CHK_hotspots_display_order', '"display_order" >= 0')
export class Hotspot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'revision_id', type: 'uuid' })
  revisionId!: string;

  @ManyToOne(() => ExhibitRevision, (revision) => revision.hotspots, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'revision_id' })
  revision!: ExhibitRevision;

  // Lưu chuỗi JSON song ngữ `{"vi":…,"en":…}` (mỗi ngôn ngữ ≤ 200 ký tự) — varchar(200) không đủ chỗ.
  @Column({ type: 'text' })
  label!: string;

  @Column({ type: 'text' })
  body!: string;

  // PostgreSQL numeric is returned as a string by the pg driver.
  @Column({ name: 'position_x', type: 'numeric' })
  positionX!: string;

  @Column({ name: 'position_y', type: 'numeric' })
  positionY!: string;

  @Column({ name: 'position_z', type: 'numeric' })
  positionZ!: string;

  @Column({ name: 'display_order', type: 'integer', default: 0 })
  displayOrder!: number;
}
