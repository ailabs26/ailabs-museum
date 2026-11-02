import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

/** Loại thông báo — FE chọn icon theo loại. */
export enum NotificationType {
  REVISION_SUBMITTED = 'revision.submitted',
  REVISION_APPROVED = 'revision.approved',
  REVISION_REJECTED = 'revision.rejected',
  REPORT_CREATED = 'report.created',
}

/** Thông báo trong CMS cho một người dùng; người nhận tự đánh dấu đã đọc hoặc xóa. */
@Entity('notifications')
@Index('IDX_notifications_user_created', ['userId', 'createdAt'])
@Index('IDX_notifications_user_unread', ['userId'], { where: '"read_at" IS NULL' })
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 40 })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  /** Nội dung chi tiết (vd lý do từ chối, mô tả báo cáo) — có thể dài, FE cắt và cho "Xem thêm". */
  @Column({ type: 'text', nullable: true })
  body!: string | null;

  /** Đường dẫn trong CMS để mở khi bấm thông báo. */
  @Column({ type: 'varchar', length: 300, nullable: true })
  link!: string | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
