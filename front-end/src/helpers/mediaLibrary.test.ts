import { describe, expect, it } from 'vitest';
import { formatBytes, hasMediaRights, uploadSizeError } from './mediaLibrary';

describe('mediaLibrary', () => {
  it('formats sizes with decimal units like the back-end limits', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2_532)).toBe('3 KB');
    expect(formatBytes(2_000_000)).toBe('2.0 MB');
  });

  it('flags files over the per-kind limit and accepts files at the limit', () => {
    expect(uploadSizeError(2_000_000, 'image')).toBeNull();
    expect(uploadSizeError(2_000_001, 'image')).toContain('2.0 MB');
    expect(uploadSizeError(9_000_000, 'model')).toBeNull();
    expect(uploadSizeError(1_000_001, 'subtitle')).not.toBeNull();
  });

  it('requires source, author and license (non-blank) for publish rights', () => {
    expect(hasMediaRights({ source: 'Bảo tàng', author: 'A', license: 'CC0' })).toBe(true);
    expect(hasMediaRights({ source: 'Bảo tàng', author: '  ', license: 'CC0' })).toBe(false);
    expect(hasMediaRights({ source: null, author: 'A', license: 'CC0' })).toBe(false);
  });
});
