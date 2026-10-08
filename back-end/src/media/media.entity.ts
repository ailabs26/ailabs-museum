import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum MediaKind {
  MODEL = 'model',
  IMAGE = 'image',
  AUDIO = 'audio',
}

export enum MediaProcessingState {
  PENDING = 'pending',
  READY = 'ready',
  FAILED = 'failed',
}

@Entity('media')
@Check('CHK_media_kind', '"kind" IN (\'model\', \'image\', \'audio\')')
@Check('CHK_media_state', '"processing_state" IN (\'pending\', \'ready\', \'failed\')')
@Check('CHK_media_size', '"size_bytes" > 0')
@Check('CHK_media_deleted', '"is_deleted" = ("deleted_at" IS NOT NULL)')
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 12 })
  kind!: MediaKind;

  @Column({ name: 'storage_key', type: 'text', unique: true })
  storageKey!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 120 })
  mimeType!: string;

  // PostgreSQL bigint is returned as a string by the pg driver.
  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes!: string;

  @Column({ name: 'checksum_sha256', type: 'char', length: 64 })
  checksumSha256!: string;

  @Column({ name: 'processing_state', type: 'varchar', length: 12 })
  processingState!: MediaProcessingState;

  @Column({ name: 'alt_text', type: 'varchar', length: 240, nullable: true })
  altText!: string | null;

  @Column({ type: 'text', nullable: true })
  source!: string | null;

  @Column({ type: 'text', nullable: true })
  license!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  createdBy!: User | null;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted!: boolean;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
