import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MediaUrlService } from '../services/media-url.service';
import { TEST_MEDIA_URL_OPTIONS, testMediaUrlService } from './media-test-doubles';

const KEY = 'uploads/images/0f8fad5b-d9cb-469f-a165-70867728950e.png';
const OTHER_KEY = 'uploads/images/7c9e6679-7425-40de-944b-e07fc1f90ae7.png';
const NOW = Date.UTC(2026, 9, 15, 12, 0, 0);

function parse(url: string): { path: string; exp: string; sig: string } {
  const parsed = new URL(url);
  return {
    path: parsed.pathname,
    exp: parsed.searchParams.get('exp') ?? '',
    sig: parsed.searchParams.get('sig') ?? '',
  };
}

describe('MediaUrlService', () => {
  const urls = testMediaUrlService();

  describe('publicUrl', () => {
    it('dựng URL tuyệt đối từ base URL + /media + storage key', () => {
      assert.equal(urls.publicUrl(KEY), `http://api.test/media/${KEY}`);
    });

    it('bỏ dấu / thừa ở cuối base URL', () => {
      const service = new MediaUrlService({ ...TEST_MEDIA_URL_OPTIONS, publicBaseUrl: 'https://api.example.com//' });
      assert.equal(service.publicUrl(KEY), `https://api.example.com/media/${KEY}`);
    });

    it('key vùng cách ly hoặc ngoài uploads/ → null', () => {
      assert.equal(urls.publicUrl('quarantine/abc.bin'), null);
      assert.equal(urls.publicUrl('secret/abc.png'), null);
      assert.equal(urls.signedUrl('quarantine/abc.bin', NOW), null);
    });
  });

  describe('signedUrl + verify', () => {
    it('URL ký hợp lệ được chấp nhận, exp = now + TTL', () => {
      const { path, exp, sig } = parse(String(urls.signedUrl(KEY, NOW)));
      assert.equal(path, `/media/${KEY}`);
      assert.equal(Number(exp), Math.floor(NOW / 1000) + TEST_MEDIA_URL_OPTIONS.signedUrlTtlSeconds);
      assert.match(sig, /^[0-9a-f]{64}$/);
      assert.equal(urls.verify(KEY, exp, sig, NOW), true);
    });

    it('chữ ký của file A không dùng được cho file B', () => {
      const { exp, sig } = parse(String(urls.signedUrl(KEY, NOW)));
      assert.equal(urls.verify(OTHER_KEY, exp, sig, NOW), false);
    });

    it('sửa exp (kéo dài hạn) làm chữ ký mất hiệu lực', () => {
      const { exp, sig } = parse(String(urls.signedUrl(KEY, NOW)));
      assert.equal(urls.verify(KEY, String(Number(exp) - 1), sig, NOW), false);
    });

    it('đổi một ký tự chữ ký → false', () => {
      const { exp, sig } = parse(String(urls.signedUrl(KEY, NOW)));
      const tampered = (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1);
      assert.equal(urls.verify(KEY, exp, tampered, NOW), false);
    });

    it('hết hạn: đúng thời điểm exp và sau đó → false', () => {
      const { exp, sig } = parse(String(urls.signedUrl(KEY, NOW)));
      assert.equal(urls.verify(KEY, exp, sig, Number(exp) * 1000), false);
      assert.equal(urls.verify(KEY, exp, sig, Number(exp) * 1000 + 60_000), false);
      assert.equal(urls.verify(KEY, exp, sig, Number(exp) * 1000 - 1000), true);
    });

    it('chữ ký đúng nhưng thời hạn dài hơn TTL (ký bằng cấu hình TTL lớn) → false', () => {
      const longLived = new MediaUrlService({ ...TEST_MEDIA_URL_OPTIONS, signedUrlTtlSeconds: 86_400 });
      const { exp, sig } = parse(String(longLived.signedUrl(KEY, NOW)));
      assert.equal(urls.verify(KEY, exp, sig, NOW), false);
    });

    it('khóa khác → false', () => {
      const other = new MediaUrlService({ ...TEST_MEDIA_URL_OPTIONS, signingSecret: 'another-secret-another-secret-12345' });
      const { exp, sig } = parse(String(other.signedUrl(KEY, NOW)));
      assert.equal(urls.verify(KEY, exp, sig, NOW), false);
    });

    const malformed: Array<[string, unknown, unknown]> = [
      ['thiếu exp', undefined, 'a'.repeat(64)],
      ['thiếu sig', '1792000000', undefined],
      ['exp không phải số', 'abc', 'a'.repeat(64)],
      ['exp âm', '-1', 'a'.repeat(64)],
      ['exp dạng mảng (query lặp)', ['1', '2'], 'a'.repeat(64)],
      ['sig quá ngắn', '1792000000', 'abc'],
      ['sig quá dài', '1792000000', 'a'.repeat(65)],
      ['sig chữ hoa', '1792000000', 'A'.repeat(64)],
      ['sig không phải hex', '1792000000', 'z'.repeat(64)],
    ];
    for (const [label, exp, sig] of malformed) {
      it(`tham số sai định dạng (${label}) → false, không ném lỗi`, () => {
        assert.equal(urls.verify(KEY, exp, sig, NOW), false);
      });
    }
  });
});
