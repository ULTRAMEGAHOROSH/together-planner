import { TestBed } from '@angular/core/testing';
import { formatLocalDateTime } from '@shared/time';
import { CLOCK, ZoneClock } from './zone-clock';

const utc = (y: number, mo: number, d: number, h: number, mi: number, s = 0) =>
  Date.UTC(y, mo - 1, d, h, mi, s);

function clockAt(instant: number): ZoneClock {
  TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: () => instant }] });
  return TestBed.inject(ZoneClock);
}

describe('ZoneClock (FD-33)', () => {
  it('ZC-01: now in Asia/Almaty (UTC+5)', () => {
    const clock = clockAt(utc(2026, 11, 6, 9, 20));
    expect(formatLocalDateTime(clock.nowIn('Asia/Almaty'))).toBe('2026-11-06T14:20');
    expect(clock.todayIn('Asia/Almaty')).toBe('2026-11-06');
  });

  it('ZC-02: in the evening UTC it is already tomorrow in Almaty', () => {
    const clock = clockAt(utc(2026, 11, 6, 20, 30));
    expect(clock.todayIn('Asia/Almaty')).toBe('2026-11-07');
    expect(formatLocalDateTime(clock.nowIn('Asia/Almaty'))).toBe('2026-11-07T01:30');
  });

  it('ZC-03: the same moment in Europe/Berlin', () => {
    const clock = clockAt(utc(2026, 11, 6, 20, 30));
    expect(formatLocalDateTime(clock.nowIn('Europe/Berlin'))).toBe('2026-11-06T21:30');
    expect(clock.todayIn('Europe/Berlin')).toBe('2026-11-06');
  });

  it('odd offsets, the date line, DST and midnight', () => {
    const clock = clockAt(0);
    const now = (zone: string, instant: number) => formatLocalDateTime(clock.nowIn(zone, instant));
    const moment = utc(2026, 11, 6, 9, 20);
    expect(now('Asia/Kathmandu', moment)).toBe('2026-11-06T15:05'); // +5:45
    expect(now('America/St_Johns', moment)).toBe('2026-11-06T05:50'); // −3:30
    expect(now('Pacific/Kiritimati', moment)).toBe('2026-11-06T23:20'); // +14
    expect(now('Pacific/Pago_Pago', moment)).toBe('2026-11-05T22:20'); // −11
    expect(now('UTC', moment)).toBe('2026-11-06T09:20');
    // Berlin switches to summer time at 01:00 UTC on 2026-03-29: 01:59 → 03:00.
    expect(now('Europe/Berlin', utc(2026, 3, 29, 0, 59))).toBe('2026-03-29T01:59');
    expect(now('Europe/Berlin', utc(2026, 3, 29, 1, 0))).toBe('2026-03-29T03:00');
    // h23: midnight is 00:00, never 24:00.
    expect(now('Asia/Almaty', utc(2026, 11, 6, 19, 0))).toBe('2026-11-07T00:00');
    // Seconds are dropped, not rounded.
    expect(now('UTC', utc(2026, 11, 6, 9, 20, 59))).toBe('2026-11-06T09:20');
  });

  it('does not depend on the machine zone', () => {
    // Whatever zone the test machine has (here Asia/Almaty), Berlin stays Berlin.
    const clock = clockAt(utc(2026, 11, 6, 9, 20));
    expect(formatLocalDateTime(clock.nowIn('Europe/Berlin'))).toBe('2026-11-06T10:20');
  });

  it('an unknown zone throws RangeError', () => {
    const clock = clockAt(0);
    expect(() => clock.nowIn('Mars/Olympus')).toThrow(RangeError);
  });

  describe('ZC-04: minuteTick', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(utc(2026, 11, 6, 9, 20, 30));
    });
    afterEach(() => vi.useRealTimers());

    it('fires on the minute boundary, then every 60 s (default CLOCK = Date.now)', () => {
      const clock = TestBed.inject(ZoneClock);
      const minute = () => formatLocalDateTime(clock.nowIn('UTC', clock.minuteTick()));
      expect(clock.minuteTick()).toBe(utc(2026, 11, 6, 9, 20, 30));
      vi.advanceTimersByTime(29_999);
      expect(minute()).toBe('2026-11-06T09:20');
      expect(clock.minuteTick()).toBe(utc(2026, 11, 6, 9, 20, 30)); // not yet
      vi.advanceTimersByTime(1);
      expect(clock.minuteTick()).toBe(utc(2026, 11, 6, 9, 21));
      vi.advanceTimersByTime(59_999);
      expect(minute()).toBe('2026-11-06T09:21');
      vi.advanceTimersByTime(1);
      expect(minute()).toBe('2026-11-06T09:22');
      vi.advanceTimersByTime(60_000 * 3);
      expect(minute()).toBe('2026-11-06T09:25');
      expect(vi.getTimerCount()).toBe(1);
    });

    it('catches up after a long pause (sleeping laptop) and stays aligned', () => {
      const clock = TestBed.inject(ZoneClock);
      vi.setSystemTime(utc(2026, 11, 6, 11, 0, 45)); // clock jumped while the timer waited
      vi.advanceTimersByTime(30_000);
      expect(clock.minuteTick()).toBe(utc(2026, 11, 6, 11, 1, 15));
      vi.advanceTimersByTime(45_000); // next boundary is 11:02:00
      expect(clock.minuteTick()).toBe(utc(2026, 11, 6, 11, 2));
    });

    it('stops its timer when the injector is destroyed', () => {
      TestBed.inject(ZoneClock);
      expect(vi.getTimerCount()).toBe(1);
      TestBed.resetTestingModule();
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
