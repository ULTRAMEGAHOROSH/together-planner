import { DAY_MINUTES as TIME_DAY_MINUTES } from '@shared/time/local-date-time';
import {
  CARD_GAP,
  DAY_HEIGHT,
  DAY_MINUTES,
  MIN_CARD_HEIGHT,
  PX_PER_HOUR,
  PX_PER_MIN,
  TALL_CARD_MIN_HEIGHT,
  TINY_CARD_MAX_HEIGHT,
} from './constants';

describe('timeline constants (WEEK-01, FD-56)', () => {
  it('scale of the prototype: 40 px per hour, 2/3 px per minute, 960 px per day', () => {
    expect(PX_PER_HOUR).toBe(40);
    expect(PX_PER_MIN * 60).toBe(40);
    expect(DAY_HEIGHT).toBe(960);
  });

  it('one day length for the whole app: the engine re-exports shared/time', () => {
    expect(DAY_MINUTES).toBe(TIME_DAY_MINUTES);
    expect(DAY_MINUTES).toBe(1440);
  });

  it('density thresholds are consistent with the card sizes', () => {
    // An hour-long card (40 − gap) is tall; the shortest card is tiny.
    expect(PX_PER_HOUR - CARD_GAP).toBeGreaterThanOrEqual(TALL_CARD_MIN_HEIGHT);
    expect(MIN_CARD_HEIGHT).toBeLessThan(TINY_CARD_MAX_HEIGHT);
    expect(TINY_CARD_MAX_HEIGHT).toBeLessThan(TALL_CARD_MIN_HEIGHT);
  });
});
