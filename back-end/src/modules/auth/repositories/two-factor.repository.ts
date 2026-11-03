import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { UserRecoveryCode } from '../entities/user-recovery-code.entity';

/** Trạng thái 2FA của user, gồm các cột `select: false`. */
export interface TwoFactorState {
  enabledAt: Date | null;
  secretEnc: string | null;
  pendingEnc: string | null;
  lastStep: number | null;
}

/** Truy cập các cột 2FA trên `users` (không select mặc định) và bảng mã khôi phục. */
@Injectable()
export class TwoFactorRepository {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserRecoveryCode) private readonly codes: Repository<UserRecoveryCode>,
  ) {}

  async getState(userId: string, manager?: EntityManager): Promise<TwoFactorState | null> {
    const user = await this.usersOf(manager)
      .createQueryBuilder('u')
      .select(['u.id', 'u.totpEnabledAt'])
      .addSelect(['u.totpSecretEnc', 'u.totpPendingEnc', 'u.totpLastStep'])
      .where('u.id = :userId', { userId })
      .getOne();
    if (!user) return null;
    return {
      enabledAt: user.totpEnabledAt,
      secretEnc: user.totpSecretEnc,
      pendingEnc: user.totpPendingEnc,
      lastStep: user.totpLastStep === null ? null : Number(user.totpLastStep),
    };
  }

  async setPending(userId: string, pendingEnc: string): Promise<void> {
    await this.users.update(userId, { totpPendingEnc: pendingEnc });
  }

  /** Bật 2FA: secret chờ → secret chính, ghi bước mã vừa dùng, thay toàn bộ mã khôi phục. */
  async enable(userId: string, secretEnc: string, step: number, codeHashes: string[], manager: EntityManager): Promise<void> {
    await this.usersOf(manager).update(userId, {
      totpSecretEnc: secretEnc, totpPendingEnc: null, totpEnabledAt: new Date(), totpLastStep: String(step),
    });
    await this.replaceRecoveryCodes(userId, codeHashes, manager);
  }

  /** Tắt 2FA: xóa secret, bước mã và mọi mã khôi phục. */
  async disable(userId: string, manager: EntityManager): Promise<void> {
    await this.usersOf(manager).update(userId, {
      totpSecretEnc: null, totpPendingEnc: null, totpEnabledAt: null, totpLastStep: null,
    });
    await this.codesOf(manager).delete({ userId });
  }

  /**
   * Ghi nhận bước mã TOTP vừa dùng — nguyên tử: chỉ thành công nếu bước này mới hơn bước đã dùng, nên cùng một mã
   * (kể cả 2 request song song) chỉ dùng được một lần.
   */
  async claimStep(userId: string, step: number, manager?: EntityManager): Promise<boolean> {
    const [, affected]: [unknown, number] = await this.usersOf(manager).query(
      `UPDATE users SET totp_last_step = $2
       WHERE id = $1 AND totp_enabled_at IS NOT NULL AND (totp_last_step IS NULL OR totp_last_step < $2)`,
      [userId, step],
    );
    return affected > 0;
  }

  /** Dùng một mã khôi phục (đánh dấu used_at); false nếu không có hoặc đã dùng. */
  async consumeRecoveryCode(userId: string, codeHash: string, manager?: EntityManager): Promise<boolean> {
    const result = await this.codesOf(manager).update(
      { userId, codeHash, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    return (result.affected ?? 0) > 0;
  }

  async replaceRecoveryCodes(userId: string, codeHashes: string[], manager: EntityManager): Promise<void> {
    await this.codesOf(manager).delete({ userId });
    if (codeHashes.length > 0) {
      await this.codesOf(manager).insert(codeHashes.map((codeHash) => ({ userId, codeHash })));
    }
  }

  countRemainingRecoveryCodes(userId: string): Promise<number> {
    return this.codes.count({ where: { userId, usedAt: IsNull() } });
  }

  private usersOf(manager?: EntityManager): Repository<User> {
    return manager ? manager.getRepository(User) : this.users;
  }

  private codesOf(manager?: EntityManager): Repository<UserRecoveryCode> {
    return manager ? manager.getRepository(UserRecoveryCode) : this.codes;
  }
}
