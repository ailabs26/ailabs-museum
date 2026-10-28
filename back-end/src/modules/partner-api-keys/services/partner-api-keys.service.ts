import { createHash, randomBytes } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePartnerApiKeyDto } from '../dto/create-partner-api-key.dto';
import {
  CreatedPartnerApiKeyResponse, PartnerApiKeyResponse, toPartnerApiKeyResponse,
} from '../dto/partner-api-key-response.dto';
import { PartnerApiKey } from '../entities/partner-api-key.entity';
import { PartnerApiKeysRepository } from '../repositories/partner-api-keys.repository';

const KEY_PREFIX = 'ak_live_';
const DAY_MS = 86_400_000;
const DEFAULT_RATE_LIMIT_PER_MINUTE = 60;
/** Ghi `lastUsedAt` tối đa mỗi phút một lần cho mỗi key, tránh ghi DB ở mọi request. */
const LAST_USED_WRITE_INTERVAL_MS = 60_000;

@Injectable()
export class PartnerApiKeysService {
  private readonly lastUsedWrites = new Map<string, number>();

  constructor(private readonly keys: PartnerApiKeysRepository) {}

  /** Tra khóa thô (header X-API-Key) → key dùng được; null nếu sai, đã thu hồi, đã xóa hoặc hết hạn. */
  authenticate(plaintext: string, now = new Date()): Promise<PartnerApiKey | null> {
    if (!plaintext.startsWith(KEY_PREFIX)) return Promise.resolve(null);
    return this.keys.findUsableByHash(hashKey(plaintext), now);
  }

  /** Cập nhật lần dùng gần nhất (đã giới hạn tần suất ghi); lỗi ghi không làm hỏng request của đối tác. */
  async recordUse(key: PartnerApiKey, now = new Date()): Promise<void> {
    const last = this.lastUsedWrites.get(key.id) ?? key.lastUsedAt?.getTime() ?? 0;
    if (now.getTime() - last < LAST_USED_WRITE_INTERVAL_MS) return;
    this.lastUsedWrites.set(key.id, now.getTime());
    await this.keys.touchLastUsed(key.id, now).catch(() => undefined);
  }

  async list(): Promise<PartnerApiKeyResponse[]> {
    return (await this.keys.listAll()).map(toPartnerApiKeyResponse);
  }

  async create(dto: CreatePartnerApiKeyDto): Promise<CreatedPartnerApiKeyResponse> {
    const token = randomBytes(24).toString('hex');
    const plaintext = KEY_PREFIX + token;
    const keyHash = hashKey(plaintext);
    // Va chạm hash gần như không thể xảy ra, nhưng vẫn phòng để không vi phạm unique.
    if (await this.keys.existsByHash(keyHash)) {
      throw new ConflictException('Trùng khóa, vui lòng thử lại');
    }
    const entity = this.keys.create({
      partnerName: dto.partnerName.trim(),
      label: dto.label?.trim() ?? '',
      scopes: dto.scopes,
      status: 'active',
      keyPrefix: KEY_PREFIX,
      keyHash,
      last4: token.slice(-4),
      expiresAt: dto.expiresInDays ? new Date(Date.now() + dto.expiresInDays * DAY_MS) : null,
      lastUsedAt: null,
      revokedAt: null,
      rateLimitPerMinute: dto.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT_PER_MINUTE,
    });
    const saved = (await this.keys.save(entity)) as PartnerApiKey;
    return { ...toPartnerApiKeyResponse(saved), plaintext };
  }

  async revoke(id: string): Promise<PartnerApiKeyResponse> {
    const entity = await this.requireById(id);
    if (entity.status === 'revoked') {
      throw new ConflictException('Khóa đã bị thu hồi trước đó');
    }
    entity.status = 'revoked';
    entity.revokedAt = new Date();
    const saved = (await this.keys.save(entity)) as PartnerApiKey;
    return toPartnerApiKeyResponse(saved);
  }

  /** Xóa mềm: key biến mất khỏi danh sách và không dùng được nữa, bản ghi vẫn giữ để truy vết. */
  async remove(id: string): Promise<void> {
    const entity = await this.requireById(id);
    const now = new Date();
    if (entity.status === 'active') {
      entity.status = 'revoked';
      entity.revokedAt = now;
    }
    entity.isDeleted = true;
    entity.deletedAt = now;
    await this.keys.save(entity);
  }

  private async requireById(id: string): Promise<PartnerApiKey> {
    const entity = await this.keys.findById(id);
    if (!entity) throw new NotFoundException('Không tìm thấy API key');
    return entity;
  }
}

function hashKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}
