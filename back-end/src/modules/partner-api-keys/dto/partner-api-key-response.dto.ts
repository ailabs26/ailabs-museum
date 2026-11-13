import { PartnerApiKey, type ApiKeyStatus } from '../entities/partner-api-key.entity';

/** Response an toàn: KHÔNG bao giờ chứa keyHash hay khóa thô. */
export interface PartnerApiKeyResponse {
  id: string;
  partnerName: string;
  label: string;
  scopes: string[];
  status: ApiKeyStatus;
  maskedKey: string;
  prefix: string;
  last4: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  rateLimitPerMinute: number;
}

/** Trả về khi tạo mới: kèm khóa thô `plaintext` (chỉ lần này). */
export interface CreatedPartnerApiKeyResponse extends PartnerApiKeyResponse {
  plaintext: string;
}

export function toPartnerApiKeyResponse(entity: PartnerApiKey): PartnerApiKeyResponse {
  return {
    id: entity.id,
    partnerName: entity.partnerName,
    label: entity.label ?? '',
    scopes: entity.scopes ?? [],
    status: entity.status,
    maskedKey: `${entity.keyPrefix}••••${entity.last4}`,
    prefix: entity.keyPrefix,
    last4: entity.last4,
    createdAt: entity.createdAt.toISOString(),
    expiresAt: entity.expiresAt ? entity.expiresAt.toISOString() : null,
    lastUsedAt: entity.lastUsedAt ? entity.lastUsedAt.toISOString() : null,
    revokedAt: entity.revokedAt ? entity.revokedAt.toISOString() : null,
    rateLimitPerMinute: entity.rateLimitPerMinute,
  };
}
