import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum MediaKind {
  MODEL = 'model',
  IMAGE = 'image',
  AUDIO = 'audio',
  /** Phụ đề WebVTT đi kèm audio guide. */
  SUBTITLE = 'subtitle',
}

export enum MediaProcessingState {
  PENDING = 'pending',
  READY = 'ready',
  FAILED = 'failed',
  /** File nghi ngờ: lưu ngoài thư mục public, không được gắn vào nội dung. */
  QUARANTINED = 'quarantined',
}

@Entity('media')
@Check('CHK_media_kind', '"kind" IN (\'model\', \'image\', \'audio\', \'subtitle\')')
@Check(
  'CHK_media_state',
  '"processing_state" IN (\'pending\', \'ready\', \'failed\', \'quarantined\')',
)
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

  @Column({
    name: 'processing_state',
    type: 'varchar',
    length: 12,
    default: MediaProcessingState.PENDING,
  })
  processingState!: MediaProcessingState;

  /** Tên file gốc phía client (đã làm sạch) — chỉ để hiển thị, không dùng làm đường dẫn. */
  @Column({ name: 'original_name', type: 'varchar', length: 255, nullable: true })
  originalName!: string | null;

  @Column({ name: 'alt_text', type: 'varchar', length: 240, nullable: true })
  altText!: string | null;

  // Metadata quyền sử dụng (FR-97): nguồn, tác giả, giấy phép.
  @Column({ type: 'text', nullable: true })
  source!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  author!: string | null;

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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
