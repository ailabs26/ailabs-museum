import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exhibit } from '../exhibits/exhibit.entity';

export enum RoomStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
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
