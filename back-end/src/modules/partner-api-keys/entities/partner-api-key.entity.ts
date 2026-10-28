import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export const API_KEY_STATUSES = ['active', 'revoked'] as const;
export type ApiKeyStatus = (typeof API_KEY_STATUSES)[number];

/**
 * API key cấp cho đối tác tích hợp. KHÔNG lưu khóa thô — chỉ lưu SHA-256 hash
 * (`keyHash`) để đối chiếu khi đối tác gọi API, kèm tiền tố + 4 ký tự cuối để
 * hiển thị dạng che trong CMS.
 */
@Entity('partner_api_keys')
@Check('CHK_partner_api_keys_status', `"status" IN ('active', 'revoked')`)
@Check('CHK_partner_api_keys_rate_limit', '"rate_limit_per_minute" BETWEEN 1 AND 10000')
@Check('CHK_partner_api_keys_deleted', '"is_deleted" = ("deleted_at" IS NOT NULL)')
export class PartnerApiKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'partner_name', type: 'varchar', length: 120 })
  partnerName!: string;

  @Column({ type: 'varchar', length: 160, default: '' })
  label!: string;

  /** Danh sách scope cho phép, ví dụ `["public:read", "tour:embed"]`. */
  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  scopes!: string[];

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status!: ApiKeyStatus;

  @Column({ name: 'key_prefix', type: 'varchar', length: 16 })
  keyPrefix!: string;

  @Index('UQ_partner_api_keys_hash', { unique: true })
  @Column({ name: 'key_hash', type: 'char', length: 64 })
  keyHash!: string;

  @Column({ type: 'varchar', length: 8 })
  last4!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  /** Số request tối đa mỗi phút cho key này (cổng /partner/v1). */
  @Column({ name: 'rate_limit_per_minute', type: 'integer', default: 60 })
  rateLimitPerMinute!: number;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted!: boolean;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
