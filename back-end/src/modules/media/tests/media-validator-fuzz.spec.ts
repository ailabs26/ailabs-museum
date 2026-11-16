import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MediaFormatError } from '../inspection/media-format.error';
import { detectMediaFormat } from '../inspection/media-signature';
import { validateMediaStructure } from '../inspection/media-structure';
import { SEED_FILES, createRng, mutatedCases } from './media-fuzz-corpus';

/**
 * Task 28 (AC-33) — fuzz trực tiếp tầng nhận diện + kiểm tra cấu trúc (không qua HTTP), số lượng lớn.
 *
 * Bất biến: với MỌI chuỗi byte, `detectMediaFormat` không ném lỗi và `validateMediaStructure`
 * chỉ được ném `MediaFormatError` (→ 422 có mã rõ ràng). Lỗi loại khác (RangeError, TypeError...)
 * nghĩa là parser bị chuỗi byte độc làm hỏng — MediaService sẽ đưa file vào quarantine thay vì
 * từ chối gọn, nên đó là lỗi cần sửa. Mỗi file phải xử lý xong nhanh (không treo, không nổ CPU).
 *
 *   FUZZ_SEED=<seed> FUZZ_VALIDATOR_ITERATIONS=<n> npm run test:fuzz
 */
const SEED = Number(process.env.FUZZ_SEED ?? 20261113);
const ITERATIONS = Number(process.env.FUZZ_VALIDATOR_ITERATIONS ?? 2000);
const MAX_MS_PER_FILE = 250;

function check(buffer: Buffer, label: string): 'accepted' | 'rejected' | 'unknown-format' {
  const started = performance.now();
  const format = detectMediaFormat(buffer);
  if (!format) return 'unknown-format';
  try {
    validateMediaStructure(format, buffer);
    return 'accepted';
  } catch (error) {
    if (!(error instanceof MediaFormatError)) {
      assert.fail(`[${label}] validator ${format} ném ${(error as Error)?.name}: ${(error as Error)?.message} — bytes(hex, 64 đầu)=${buffer.subarray(0, 64).toString('hex')}`);
    }
    return 'rejected';
  } finally {
    const elapsed = performance.now() - started;
    assert.ok(elapsed < MAX_MS_PER_FILE, `[${label}] xử lý mất ${elapsed.toFixed(0)} ms`);
  }
}

describe(`Fuzz validator media (Task 28) — seed ${SEED}, ${ITERATIONS} biến thể/định dạng`, () => {
  it('đột biến file hợp lệ: chỉ ném MediaFormatError, không treo', () => {
    const stats = { accepted: 0, rejected: 0, 'unknown-format': 0 };
    for (const c of mutatedCases(SEED, ITERATIONS)) stats[check(c.buffer, c.label)] += 1;
    console.log(`[validator-fuzz] seed=${SEED} đột biến=${ITERATIONS * SEED_FILES.length} ${JSON.stringify(stats)}`);
    assert.ok(stats.rejected > 0 && stats.accepted > 0, 'bộ sinh phải tạo được cả file hỏng lẫn file còn hợp lệ');
  });

  it('magic bytes đúng + thân ngẫu nhiên: chỉ ném MediaFormatError, không treo', () => {
    const rng = createRng(SEED ^ 0x5eed);
    let total = 0;
    for (const file of SEED_FILES) {
      const original = file.build();
      for (let i = 0; i < ITERATIONS; i += 1) {
        // Giữ 4–16 byte đầu (đủ để nhận đúng định dạng), phần còn lại là byte ngẫu nhiên độ dài bất kỳ.
        const head = original.subarray(0, rng.int(4, Math.min(16, original.length)));
        check(Buffer.concat([head, rng.bytes(rng.int(0, 512))]), `${file.format}-random#${i}`);
        total += 1;
      }
    }
    console.log(`[validator-fuzz] seed=${SEED} magic+ngẫu nhiên=${total}`);
  });
});
