import { isMonday } from '@shared/time';
import {
  APPLY_MODE_OPTIONS,
  asksIncludeManual,
  mondayOf,
  shiftWeek,
  toApplyRequest,
  weeksBetween,
} from './apply-params';

describe('apply params (TPL-05)', () => {
  it('has the three modes in the order of the prototype', () => {
    expect(APPLY_MODE_OPTIONS.map((o) => o.mode)).toEqual(['MERGE', 'FILL', 'REPLACE']);
  });

  it('only «Заменить» asks about manual events', () => {
    expect(APPLY_MODE_OPTIONS.filter((o) => asksIncludeManual(o.mode)).map((o) => o.mode)).toEqual([
      'REPLACE',
    ]);
  });

  it('a week is always a Monday, also after stepping', () => {
    expect(mondayOf('2026-11-18')).toBe('2026-11-16');
    expect(mondayOf('2026-11-22')).toBe('2026-11-16');
    for (const weeks of [-3, -1, 1, 2, 60]) {
      expect(isMonday(shiftWeek('2026-11-16', weeks))).toBe(true);
    }
    expect(shiftWeek('2026-11-16', 1)).toBe('2026-11-23');
    expect(shiftWeek('2026-12-28', 1)).toBe('2027-01-04');
    expect(weeksBetween('2026-11-09', '2026-11-30')).toBe(3);
    expect(weeksBetween('2026-11-23', '2026-11-09')).toBe(-2);
  });

  it('the request carries includeManual only for REPLACE and no confirmed sets', () => {
    const base = { weekStart: '2026-11-23', includeManual: true };
    expect(toApplyRequest({ ...base, mode: 'REPLACE' })).toEqual({
      weekStart: '2026-11-23',
      mode: 'REPLACE',
      includeManual: true,
      confirmedDeleteIds: null,
      confirmedRestoredIds: null,
    });
    expect(toApplyRequest({ ...base, mode: 'MERGE' }).includeManual).toBe(false);
    expect(toApplyRequest({ ...base, mode: 'FILL' }).includeManual).toBe(false);
    expect(toApplyRequest({ ...base, mode: 'REPLACE', includeManual: false }).includeManual).toBe(
      false,
    );
  });
});
