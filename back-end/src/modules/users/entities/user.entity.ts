import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RefreshSession } from '../../auth/entities/refresh-session.entity';
import { UserRole } from './user-role.entity';

export enum UserStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

@Entity('users')
@Check('CHK_users_status', '"status" IN (\'active\', \'disabled\')')
@Check('CHK_users_deleted', '"is_deleted" = ("deleted_at" IS NOT NULL)')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'citext', unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 160 })
  displayName!: string;

  @Column({ type: 'varchar', length: 12, default: UserStatus.ACTIVE })
  status!: UserStatus;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted!: boolean;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  /** 2FA (TOTP) đang bật từ thời điểm này; null = chưa bật. Không bí mật nên được select mặc định. */
  @Column({ name: 'totp_enabled_at', type: 'timestamptz', nullable: true })
  totpEnabledAt!: Date | null;

  /** Secret TOTP đang dùng, đã mã hóa (secret-box). Không select mặc định. */
  @Column({ name: 'totp_secret_enc', type: 'text', nullable: true, select: false })
  totpSecretEnc!: string | null;

  /** Secret vừa tạo khi thiết lập, chờ xác nhận bằng mã đầu tiên. Không select mặc định. */
  @Column({ name: 'totp_pending_enc', type: 'text', nullable: true, select: false })
  totpPendingEnc!: string | null;

  /** Bước thời gian (30 giây) của mã TOTP dùng gần nhất — chống dùng lại cùng một mã. Không select mặc định. */
  @Column({ name: 'totp_last_step', type: 'bigint', nullable: true, select: false })
  totpLastStep!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => UserRole, (userRole) => userRole.user)
  userRoles!: UserRole[];

  @OneToMany(() => RefreshSession, (session) => session.user)
  refreshSessions!: RefreshSession[];
}
