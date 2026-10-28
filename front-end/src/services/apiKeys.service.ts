import { makeId, readCollection, writeCollection } from './clientStore';

/**
 * Dịch vụ quản lý danh sách API Key của đối tác (CMS).
 *
 * Mô phỏng quy ước an toàn thường gặp: khóa đầy đủ chỉ hiện MỘT LẦN ngay sau khi
 * tạo; sau đó chỉ lưu tiền tố + 4 ký tự cuối để hiển thị dạng che. Hiện lưu phía
 * client (xem clientStore) chờ endpoint backend; khi có BE, chỗ sinh khóa cần
 * chuyển sang hash phía server và không bao giờ lưu khóa thô.
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

const STORE_KEY = 'apiKeys';
const KEY_PREFIX = 'ak_live_';

/** Sinh chuỗi ngẫu nhiên an toàn (ưu tiên Web Crypto, fallback Math.random). */
function randomToken(bytes = 24): string {
  try {
    const buf = new Uint8Array(bytes);
    crypto.getRandomValues(buf);
    return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let out = '';
    while (out.length < bytes * 2) out += Math.random().toString(16).slice(2);
    return out.slice(0, bytes * 2);
  }
}

function mask(last4: string): string {
  return `${KEY_PREFIX}••••${last4}`;
}

function seed(): PartnerApiKey[] {
  const now = Date.now();
  const iso = (offsetDays: number) => new Date(now + offsetDays * 86_400_000).toISOString();
  return [
    {
      id: makeId('key'),
      partnerName: 'VietnamPlus',
      label: 'Nhúng tour cho báo điện tử',
      scopes: ['public:read', 'exhibits:read', 'tour:embed'],
      status: 'active',
      prefix: KEY_PREFIX,
      last4: '9f3c',
      maskedKey: mask('9f3c'),
      createdAt: iso(-42),
      expiresAt: iso(323),
      lastUsedAt: iso(-1),
      revokedAt: null,
    },
    {
      id: makeId('key'),
      partnerName: 'EduTech Labs',
      label: 'Tích hợp giáo trình số',
      scopes: ['public:read', 'media:read', 'analytics:read'],
      status: 'active',
      prefix: KEY_PREFIX,
      last4: '27ab',
      maskedKey: mask('27ab'),
      createdAt: iso(-12),
      expiresAt: null,
      lastUsedAt: iso(-5),
      revokedAt: null,
    },
    {
      id: makeId('key'),
      partnerName: 'Hanoi Tourism',
      label: 'Thử nghiệm (đã thu hồi)',
      scopes: ['public:read'],
      status: 'revoked',
      prefix: KEY_PREFIX,
      last4: 'ee10',
      maskedKey: mask('ee10'),
      createdAt: iso(-90),
      expiresAt: null,
      lastUsedAt: iso(-60),
      revokedAt: iso(-30),
    },
  ];
}

export const apiKeysService = {
  async list(): Promise<PartnerApiKey[]> {
    const rows = await readCollection<PartnerApiKey>(STORE_KEY, seed);
    return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async create(input: CreateApiKeyInput): Promise<CreatedApiKey> {
    const rows = await readCollection<PartnerApiKey>(STORE_KEY, seed);
    const token = randomToken();
    const plaintext = KEY_PREFIX + token;
    const last4 = token.slice(-4);
    const record: PartnerApiKey = {
      id: makeId('key'),
      partnerName: input.partnerName.trim(),
      label: input.label.trim(),
      scopes: input.scopes,
      status: 'active',
      prefix: KEY_PREFIX,
      last4,
      maskedKey: mask(last4),
      createdAt: new Date().toISOString(),
      expiresAt: input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
        : null,
      lastUsedAt: null,
      revokedAt: null,
    };
    await writeCollection(STORE_KEY, [record, ...rows]);
    return { record, plaintext };
  },

  async revoke(id: string): Promise<PartnerApiKey> {
    const rows = await readCollection<PartnerApiKey>(STORE_KEY, seed);
    let updated: PartnerApiKey | undefined;
    const next = rows.map((row) => {
      if (row.id !== id) return row;
      updated = { ...row, status: 'revoked' as const, revokedAt: new Date().toISOString() };
      return updated;
    });
    await writeCollection(STORE_KEY, next);
    if (!updated) throw new Error('Không tìm thấy API key');
    return updated;
  },

  async remove(id: string): Promise<void> {
    const rows = await readCollection<PartnerApiKey>(STORE_KEY, seed);
    await writeCollection(STORE_KEY, rows.filter((row) => row.id !== id));
  },
};
