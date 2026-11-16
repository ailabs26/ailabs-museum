import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertLocalDatabaseUrl, loadRoomSlug, parseLoadRoomCount } from './k6-load-data';

describe('k6-load-data — chặn chạy ngoài DB local', () => {
  for (const url of [
    'postgres://postgres:k6@localhost:5432/k6',
    'postgres://postgres:k6@127.0.0.1:55433/k6',
    'postgres://postgres:k6@[::1]:5432/k6',
  ]) {
    it(`chấp nhận ${url}`, () => assert.doesNotThrow(() => assertLocalDatabaseUrl(url)));
  }

  for (const url of [
    'postgres://postgres.abc:secret@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
    'postgres://u:p@10.0.0.5:5432/db',
    'postgres://u:p@localhost.evil.com:5432/db',
  ]) {
    it(`từ chối host không phải local: ${new URL(url).hostname}`, () => {
      assert.throws(() => assertLocalDatabaseUrl(url), /chỉ chấp nhận DB localhost/);
    });
  }

  it('thiếu DATABASE_URL → lỗi', () => assert.throws(() => assertLocalDatabaseUrl(undefined), /Thiếu DATABASE_URL/));
  it('URL rác → lỗi', () => assert.throws(() => assertLocalDatabaseUrl('không phải url'), /không hợp lệ/));
});

describe('k6-load-data — tham số', () => {
  it('mặc định 40 phòng khi không đặt hoặc chuỗi rỗng', () => {
    assert.equal(parseLoadRoomCount(undefined), 40);
    assert.equal(parseLoadRoomCount('  '), 40);
  });
  it('nhận số nguyên trong khoảng 1–500', () => {
    assert.equal(parseLoadRoomCount('1'), 1);
    assert.equal(parseLoadRoomCount('500'), 500);
  });
  for (const raw of ['0', '501', '-3', '2.5', 'abc']) {
    it(`từ chối "${raw}"`, () => assert.throws(() => parseLoadRoomCount(raw), /K6_LOAD_ROOMS/));
  }
  it('slug đệm 0 để sắp xếp ổn định', () => {
    assert.equal(loadRoomSlug(1), 'k6-load-001');
    assert.equal(loadRoomSlug(42), 'k6-load-042');
  });
});
