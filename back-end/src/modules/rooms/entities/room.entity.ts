import type { SupportedLocale } from '../../translations/constants/locales';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exhibit } from '../../exhibits/entities/exhibit.entity';

export enum RoomStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

/** Bản dịch theo ngôn ngữ của tên và mô tả, không gồm tiếng Việt. */
export interface RoomTranslations {
  name?: Partial<Record<SupportedLocale, string>>;
  description?: Partial<Record<SupportedLocale, string>>;
}

@Entity('rooms')
@Check('CHK_rooms_status', '"status" IN (\'active\', \'archived\')')
@Check('CHK_rooms_deleted', '"is_deleted" = ("deleted_at" IS NOT NULL)')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** Bản dịch; `name`, `description` ở trên là tiếng Việt. */
  @Column({ type: 'jsonb', default: {} })
  translations!: RoomTranslations;

  @Column({ type: 'varchar', length: 12, default: RoomStatus.ACTIVE })
  status!: RoomStatus;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted!: boolean;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => Exhibit, (exhibit) => exhibit.room)
  exhibits!: Exhibit[];
}
