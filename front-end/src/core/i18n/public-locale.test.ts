import { describe, expect, it } from 'vitest';
import { fillParams } from './public-locale';

describe('fillParams', () => {
  it('thay tham số, giữ nguyên tham số không có; không truyền thì trả nguyên chuỗi', () => {
    expect(fillParams('Khám phá {name} ({count})', { name: 'Phòng A', count: 2 })).toBe('Khám phá Phòng A (2)');
    expect(fillParams('Khám phá {name}', {})).toBe('Khám phá {name}');
    expect(fillParams('Khám phá {name}')).toBe('Khám phá {name}');
  });
});
