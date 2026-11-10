import { describe, expect, it } from 'vitest';
import { GUIDED_TOUR_2D_MESSAGES } from './guidedTour2dMessages';

describe('guided tour 2D messages', () => {
  it('provides every public UI fallback in all supported locales', () => {
    for (const locale of ['vi', 'en', 'fr', 'zh', 'ko', 'ja'] as const) {
      expect(GUIDED_TOUR_2D_MESSAGES[locale]).toMatchObject({
        label: expect.any(String),
        step: expect.any(String),
        progressLabel: expect.any(String),
        recoveryLabel: expect.any(String),
        start: expect.any(String),
        continue: expect.any(String),
        startFromExhibit: expect.any(String),
        returnToStep: expect.any(String),
        routeDrift: expect.any(String),
        restart: expect.any(String),
        running: expect.any(String),
        paused: expect.any(String),
        completed: expect.any(String),
        empty: expect.any(String),
      });
    }
  });
});
