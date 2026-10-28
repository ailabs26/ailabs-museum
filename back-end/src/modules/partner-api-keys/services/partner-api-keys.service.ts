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

@Injectable()
export class PartnerApiKeysService {
  constructor(private readonly keys: PartnerApiKeysRepository) {}

  async list(): Promise<PartnerApiKeyResponse[]> {
    return (await this.keys.listAll()).map(toPartnerApiKeyResponse);
  }

  async create(dto: CreatePartnerApiKeyDto): Promise<CreatedPartnerApiKeyResponse> {
    const token = randomBytes(24).toString('hex');
    const plaintext = KEY_PREFIX + token;
    const keyHash = createHash('sha256').update(plaintext).digest('hex');
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

  async remove(id: string): Promise<void> {
    const entity = await this.requireById(id);
    await this.keys.remove(entity);
  }

  private async requireById(id: string): Promise<PartnerApiKey> {
    const entity = await this.keys.findById(id);
    if (!entity) throw new NotFoundException('Không tìm thấy API key');
    return entity;
  }
}
