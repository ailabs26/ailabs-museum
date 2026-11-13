import { expect, it } from 'vitest';
import { NavigationGestures } from './navigationGestures';

it('preserves tap, rejects returning drags and starts clean on the next gesture', () => {
  const gestures = new NavigationGestures();
  gestures.start(1, 0, 0); gestures.end(1); expect(gestures.canSelect).toBe(true);
  gestures.start(2, 0, 0); gestures.move(2, 20, 0); gestures.move(2, 0, 0); gestures.end(2);
  expect(gestures.canSelect).toBe(false);
  gestures.start(3, 1, 1); gestures.end(3); expect(gestures.canSelect).toBe(true);
});
it('tracks independent pointer IDs and rejects every part of multitouch in either release order', () => {
  for (const order of [[1, 2], [2, 1]]) {
    const gestures = new NavigationGestures();
    gestures.start(1, 0, 0); gestures.start(2, 100, 100);
    gestures.end(order[0]); expect(gestures.canSelect).toBe(false);
    gestures.end(order[1]); expect(gestures.canSelect).toBe(false);
    gestures.start(3, 10, 10); gestures.end(3); expect(gestures.canSelect).toBe(true);
  }
});
it('cancellation blocks selection and clears pointer ownership', () => {
  const gestures = new NavigationGestures(); gestures.start(1, 0, 0); gestures.cancel();
  expect(gestures.canSelect).toBe(false);
  gestures.start(2, 0, 0); gestures.end(2); expect(gestures.canSelect).toBe(true);
});
