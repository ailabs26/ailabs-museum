import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('refresh_sessions')
@Index('IDX_refresh_sessions_user_family', ['userId', 'familyId'])
@Index('IDX_refresh_sessions_family_live', ['familyId'], { where: '"revoked_at" IS NULL' })
export class RefreshSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.refreshSessions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'family_id', type: 'uuid' })
  familyId!: string;

  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true })
  tokenHash!: string;

  @Column({ name: 'replaced_by_id', type: 'uuid', nullable: true, unique: true })
  replacedById!: string | null;

  @OneToOne(() => RefreshSession, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'replaced_by_id' })
  replacedBy!: RefreshSession | null;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt!: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  /** Thời điểm tạo row (mỗi lần xoay vòng) — "hoạt động cuối" của thiết bị. */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /** Thời điểm đăng nhập; giữ nguyên qua các lần xoay vòng cùng family. */
  @Column({ name: 'signed_in_at', type: 'timestamptz', default: () => 'now()' })
  signedInAt!: Date;

  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  userAgent!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null;
}
