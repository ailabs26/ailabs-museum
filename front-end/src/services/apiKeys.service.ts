import { http } from '@/core/api/http-client';

/**
 * Dịch vụ quản lý danh sách API Key của đối tác (CMS).
 *
 * Khóa đầy đủ chỉ được backend trả về MỘT LẦN ngay sau khi tạo; sau đó máy chủ chỉ
 * lưu SHA-256 hash + tiền tố + 4 ký tự cuối, nên FE hiển thị dạng che. Dữ liệu lưu
 * ở backend (bảng `partner_api_keys`) qua các endpoint `/partner-api-keys`.
 */

export type ApiKeyStatus = 'active' | 'revoked';

export interface ApiScopeMeta {
  value: string;
  label: string;
}

/** Scope cấp cho đối tác (phạm vi đọc dữ liệu công khai của bảo tàng). */
export const API_SCOPES: readonly ApiScopeMeta[] = [
  { value: 'public:read', label: 'Đọc nội dung công khai' },
  { value: 'exhibits:read', label: 'Đọc hiện vật' },
  { value: 'rooms:read', label: 'Đọc phòng trưng bày' },
  { value: 'media:read', label: 'Đọc media (ảnh/audio/model)' },
  { value: 'tour:embed', label: 'Nhúng tour 3D' },
  { value: 'analytics:read', label: 'Đọc thống kê truy cập' },
];

export interface PartnerApiKey {
  id: string;
  partnerName: string;
  label: string;
  scopes: string[];
  status: ApiKeyStatus;
  /** Dạng hiển thị che: `ak_live_••••1a2b`. */
  maskedKey: string;
  prefix: string;
  last4: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface CreateApiKeyInput {
  partnerName: string;
  label: string;
  scopes: string[];
  /** Số ngày hiệu lực; null = không hết hạn. */
  expiresInDays: number | null;
}

/** Kết quả tạo khóa: bản ghi + khóa thô chỉ trả về một lần. */
export interface CreatedApiKey {
  record: PartnerApiKey;
  /** Khóa đầy đủ — hiển thị đúng một lần, không lưu lại. */
  plaintext: string;
}

export const apiKeysService = {
  list(): Promise<PartnerApiKey[]> {
    return http.get<PartnerApiKey[]>('/partner-api-keys');
  },

  async create(input: CreateApiKeyInput): Promise<CreatedApiKey> {
    const { plaintext, ...record } = await http.post<PartnerApiKey & { plaintext: string }>(
      '/partner-api-keys', input,
    );
    return { record, plaintext };
  },

  revoke(id: string): Promise<PartnerApiKey> {
    return http.post<PartnerApiKey>(`/partner-api-keys/${id}/revoke`);
  },

  remove(id: string): Promise<void> {
    return http.delete<void>(`/partner-api-keys/${id}`);
  },
};
