import { describe, expect, it } from 'vitest';
import { isOrderChanged, moveItem, sortForTour } from './tourOrder';

const item = (id: string, displayOrder: number) => ({ id, displayOrder });

describe('sortForTour', () => {
  it('orders by displayOrder then id like the public tour', () => {
    const sorted = sortForTour([item('c', 2), item('b', 1), item('a', 2)]);
    expect(sorted.map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('moveItem', () => {
  const list = ['a', 'b', 'c', 'd'];

  it('moves an item down and up', () => {
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(list, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('keeps the list for no-op or out-of-range moves without mutating the input', () => {
    expect(moveItem(list, 1, 1)).toEqual(list);
    expect(moveItem(list, -1, 2)).toEqual(list);
    expect(moveItem(list, 0, 4)).toEqual(list);
    expect(list).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('isOrderChanged', () => {
  it('detects a changed sequence only', () => {
    const original = [item('a', 1), item('b', 2)];
    expect(isOrderChanged(original, [item('a', 1), item('b', 2)])).toBe(false);
    expect(isOrderChanged(original, [item('b', 2), item('a', 1)])).toBe(true);
  });
});
