import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { hasScope } from '../constants/scopes';
import type { PartnerApiKey } from '../entities/partner-api-key.entity';
import type { PartnerApiKeysRepository } from '../repositories/partner-api-keys.repository';
import { PartnerApiKeysService } from '../services/partner-api-keys.service';
import { PartnerRateLimiter } from '../services/partner-rate-limiter.service';

describe('hasScope', () => {
  it('khớp đúng scope; public:read bao trùm scope đọc nội dung nhưng không gồm analytics', () => {
    assert.equal(hasScope(['rooms:read'], 'rooms:read'), true);
    assert.equal(hasScope(['rooms:read'], 'exhibits:read'), false);
    for (const scope of ['rooms:read', 'exhibits:read', 'media:read', 'tour:embed'] as const) {
      assert.equal(hasScope(['public:read'], scope), true);
    }
    assert.equal(hasScope(['public:read'], 'analytics:read'), false);
    assert.equal(hasScope([], 'rooms:read'), false);
  });
});

describe('PartnerRateLimiter', () => {
  it('cho đúng N request/phút cho mỗi key, đếm riêng từng key, mở lại sau 1 phút', () => {
    const limiter = new PartnerRateLimiter();
    let now = 1_000_000;
    limiter.now = () => now;
    const results = Array.from({ length: 3 }, () => limiter.consume('k1', 3));
    assert.deepEqual(results.map((r) => [r.allowed, r.remaining]), [[true, 2], [true, 1], [true, 0]]);
    const blocked = limiter.consume('k1', 3);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfter >= 1 && blocked.retryAfter <= 60);
    assert.equal(limiter.consume('k2', 3).allowed, true, 'key khác không bị ảnh hưởng');
    now += 60_001;
    assert.equal(limiter.consume('k1', 3).allowed, true);
  });
});

describe('PartnerApiKeysService', () => {
  function harness(stored: Partial<PartnerApiKey> = {}) {
    const log: string[] = [];
    const entity = { id: 'key-1', status: 'active', isDeleted: false, revokedAt: null, lastUsedAt: null, ...stored } as PartnerApiKey;
    const repo = {
      findUsableByHash: async (hash: string) => { log.push(`find:${hash}`); return entity; },
      touchLastUsed: async (id: string) => void log.push(`touch:${id}`),
      findById: async () => (entity.isDeleted ? null : entity),
      save: async (saved: PartnerApiKey) => { log.push('save'); return saved; },
      existsByHash: async () => false,
      create: (data: Partial<PartnerApiKey>) => ({ ...data, createdAt: new Date() }) as PartnerApiKey,
    } as unknown as PartnerApiKeysRepository;
    return { service: new PartnerApiKeysService(repo), log, entity };
  }

  it('authenticate: chỉ tra DB theo SHA-256 của khóa có đúng tiền tố, không bao giờ theo khóa thô', async () => {
    const { service, log } = harness();
    assert.equal(await service.authenticate('khong-dung-tien-to'), null);
    assert.deepEqual(log, []);
    await service.authenticate('ak_live_abc');
    assert.deepEqual(log, [`find:${createHash('sha256').update('ak_live_abc').digest('hex')}`]);
  });

  it('recordUse: ghi lastUsedAt tối đa mỗi phút một lần cho mỗi key', async () => {
    const { service, log, entity } = harness();
    const t0 = new Date('2026-11-01T00:00:00Z');
    await service.recordUse(entity, t0);
    await service.recordUse(entity, new Date(t0.getTime() + 30_000));
    await service.recordUse(entity, new Date(t0.getTime() + 61_000));
    assert.deepEqual(log, ['touch:key-1', 'touch:key-1']);
  });

  it('create: mặc định 60 request/phút; nhận giới hạn tùy chỉnh; khóa thô chỉ trả một lần', async () => {
    const { service } = harness();
    const created = await service.create({ partnerName: 'Đối tác', scopes: ['rooms:read'] });
    assert.equal(created.rateLimitPerMinute, 60);
    assert.match(created.plaintext, /^ak_live_[0-9a-f]{48}$/);
    assert.equal(JSON.stringify(created).includes('keyHash'), false);
    assert.equal((await service.create({ partnerName: 'X', scopes: ['rooms:read'], rateLimitPerMinute: 5 })).rateLimitPerMinute, 5);
  });

  it('remove: xóa mềm và thu hồi key đang hoạt động; xóa lần hai → 404', async () => {
    const { service, entity } = harness();
    await service.remove('key-1');
    assert.equal(entity.isDeleted, true);
    assert.ok(entity.deletedAt instanceof Date);
    assert.equal(entity.status, 'revoked');
    assert.ok(entity.revokedAt instanceof Date);
    await assert.rejects(service.remove('key-1'), /Không tìm thấy API key/);
  });
});
