import { isMonday } from '@shared/time';
import {
  APPLY_MODE_OPTIONS,
  applyResultText,
  asksIncludeManual,
  mondayOf,
  sameParams,
  shiftWeek,
  toApplyRequest,
  toConfirmedRequest,
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

describe('apply request and result (TPL-07)', () => {
  const params = {
    templateId: 't-1',
    weekStart: '2026-11-23',
    mode: 'REPLACE' as const,
    includeManual: false,
  };
  const preview = {
    toDelete: [{ id: 'e-1' }, { id: 'e-2' }] as never[],
    restoredDeleted: [{ templateEventId: 'te-1' }] as never[],
  };

  it('AP-07: REPLACE confirms exactly the ids of the plan on screen', () => {
    expect(toConfirmedRequest(params, preview)).toEqual({
      weekStart: '2026-11-23',
      mode: 'REPLACE',
      includeManual: false,
      confirmedDeleteIds: ['e-1', 'e-2'],
      confirmedRestoredIds: ['te-1'],
    });
  });

  it('REPLACE with nothing to delete or restore sends empty arrays, not null', () => {
    const request = toConfirmedRequest(params, { toDelete: [], restoredDeleted: [] });
    expect(request.confirmedDeleteIds).toEqual([]);
    expect(request.confirmedRestoredIds).toEqual([]);
  });

  it('AP-08: MERGE and FILL send no confirmed sets and no includeManual', () => {
    for (const mode of ['MERGE', 'FILL'] as const) {
      expect(toConfirmedRequest({ ...params, mode, includeManual: true }, preview)).toEqual({
        weekStart: '2026-11-23',
        mode,
        includeManual: false,
        confirmedDeleteIds: null,
        confirmedRestoredIds: null,
      });
    }
  });

  it('sameParams compares the whole choice, and null is never the same', () => {
    expect(sameParams(params, { ...params })).toBe(true);
    for (const change of [
      { templateId: 't-2' },
      { weekStart: '2026-11-30' },
      { mode: 'MERGE' as const },
      { includeManual: true },
    ]) {
      expect(sameParams(params, { ...params, ...change })).toBe(false);
    }
    expect(sameParams(null, null)).toBe(false);
    expect(sameParams(params, null)).toBe(false);
  });

  it('AP-10: the toast has the numbers of the application', () => {
    const base = { templateName: 'Обычная неделя', weekStart: '2026-11-09' };
    expect(applyResultText({ ...base, createdCount: 12, deletedCount: 3, skippedCount: 4 })).toBe(
      '«Обычная неделя» → 9–15 нояб.: добавлено 12, удалено 3, без дублей: пропущено 4',
    );
    expect(applyResultText({ ...base, createdCount: 3, deletedCount: 0, skippedCount: 0 })).toBe(
      '«Обычная неделя» → 9–15 нояб.: добавлено 3',
    );
  });

  it('AP-11: nothing created says everything is applied already', () => {
    const base = { templateName: 'Обычная неделя', weekStart: '2026-11-09' };
    expect(applyResultText({ ...base, createdCount: 0, deletedCount: 0, skippedCount: 5 })).toBe(
      '«Обычная неделя» → 9–15 нояб.: ничего не добавлено: всё уже применено',
    );
    expect(applyResultText({ ...base, createdCount: 0, deletedCount: 2, skippedCount: 0 })).toBe(
      '«Обычная неделя» → 9–15 нояб.: ничего не добавлено, удалено 2',
    );
  });
});
